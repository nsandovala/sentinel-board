"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";

import { CreateTaskModal } from "@/components/modals/create-task-modal";
import { MoveStateModal } from "@/components/modals/move-state-modal";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";
import { createEvent } from "@/lib/state/sentinel-reducer";
import { parseCommandLine, type CommandIntent } from "@/lib/console/command-parser";
import { executeCommandWithDispatch } from "@/lib/console/command-executor";
import { runLocalAnalysis, type LocalAnalysisResult } from "@/lib/console/local-analysis";
import {
  normalizePlannerResponse,
  plannerToLocalAnalysis,
  safeParseJSON,
} from "@/lib/agents/parse-planner-response";
import { cn } from "@/lib/utils";
import type { SentinelCard } from "@/types/card";
import type { HeoSuggestion } from "@/types/event";

import { DockModeTabs, type DockMode } from "./dock-mode-tabs";
import { CommandMode } from "./command-mode";
import { AnalyzeMode } from "./analyze-mode";
import { FocusMode } from "./focus-mode";
import { AgentsMode } from "./agents-mode";
import { CopilotInput, type CopilotInputAssist } from "./copilot-input";

const DOCK_HEIGHT_STORAGE_KEY = "sentinel:dock-height";
const DOCK_MIN_HEIGHT = 240;
const DOCK_DEFAULT_HEIGHT = 340;
const DOCK_COLLAPSED_HEIGHT = 48;
const DOCK_MAX_VH = 0.65;
const DOCK_MAX_HARD_CAP = 760;

const LIVE_INTENT_ES: Record<CommandIntent, string> = {
  create_task: "Crear tarea",
  move_status: "Mover tarjeta",
  start_focus: "Iniciar foco",
  end_focus: "Terminar foco",
  log_time: "Registrar tiempo",
  analyze: "Analizar (otra pestaña)",
  unknown: "Sin clasificar",
};

const COMMAND_FORMAT_HINT =
  "Plantillas: crear tarea [título] en [proyecto] · mover «título» a [estado] · registrar [n] horas en [proyecto] · iniciar/terminar foco";

const ANALYZE_FOOTER_HINT =
  "Ctrl + Enter para analizar. El historial vive en el Timeline.";

const FOCUS_FOOTER_HINT =
  "Escribe el nombre de un proyecto/tarea para iniciar foco. El historial vive en el Timeline.";

const RUNTIME_FOOTER_HINT =
  "Runtime aún no recibe comandos. Solo muestra estado de agentes.";

function getDockMaxHeight(): number {
  if (typeof window === "undefined") return DOCK_MAX_HARD_CAP;
  const vhCap = Math.floor(window.innerHeight * DOCK_MAX_VH);
  return Math.max(DOCK_MIN_HEIGHT, Math.min(vhCap, DOCK_MAX_HARD_CAP));
}

function clampDockHeight(height: number): number {
  return Math.min(Math.max(Math.round(height), DOCK_MIN_HEIGHT), getDockMaxHeight());
}

function buildLiveSuggestions(
  cards: SentinelCard[],
  selectedProjectId: string | null,
  projectName?: string,
): HeoSuggestion[] {
  const scoped = selectedProjectId ? cards.filter((card) => card.projectId === selectedProjectId) : cards;
  const suggestions: HeoSuggestion[] = [];

  const blocked = scoped.find((card) => card.blocked);
  if (blocked) {
    suggestions.push({
      id: `heo-blocked-${blocked.id}`,
      text: `Destrabar «${blocked.title}»`,
      command: `mover "${blocked.title}" a clarificando`,
    });
  }

  const backlog = scoped.find((card) => card.status === "idea_bruta");
  if (backlog) {
    suggestions.push({
      id: `heo-backlog-${backlog.id}`,
      text: `Aterrizar «${backlog.title}»`,
      command: `mover "${backlog.title}" a clarificando`,
    });
  }

  const inFlight = scoped.find((card) =>
    card.status === "en_proceso" || card.status === "desarrollo" || card.status === "qa",
  );
  if (inFlight) {
    const nextStatus = inFlight.status === "qa" ? "listo" : "qa";
    suggestions.push({
      id: `heo-inflight-${inFlight.id}`,
      text: `Empujar «${inFlight.title}» a ${nextStatus}`,
      command: `mover "${inFlight.title}" a ${nextStatus}`,
    });
  }

  if (projectName) {
    suggestions.push({
      id: `heo-focus-${selectedProjectId ?? "global"}`,
      text: `Abrir foco en ${projectName}`,
      command: `iniciar foco en ${projectName}`,
    });
  }

  return suggestions.slice(0, 4);
}

function formatChipElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(m)}:${pad(s)}`;
}

const MODE_TITLES: Record<DockMode, string> = {
  command: "HEO Copilot · Execute",
  analyze: "HEO Copilot · Analyze",
  focus: "HEO Copilot · Focus",
  agents: "HEO Copilot · Runtime",
};

const MODE_HINTS: Record<DockMode, string> = {
  command: "Ejecuta comandos deterministas locales",
  analyze: "Convierte contexto en backlog accionable",
  focus: "Sesión de foco · timer y tarea activa",
  agents: "Estado de los agentes del runtime",
};

type CopilotStatus = "idle" | "running" | "success" | "error";

const STATUS_LABEL: Record<CopilotStatus, string> = {
  idle: "idle",
  running: "running",
  success: "ok",
  error: "error",
};

const STATUS_CLASS: Record<CopilotStatus, string> = {
  idle: "border-border/40 bg-background/40 text-muted-foreground/75",
  running: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  error: "border-red-500/25 bg-red-500/10 text-red-300",
};

export function DockWorkspace() {
  const [expanded, setExpanded] = useState(false);
  const [dockHeight, setDockHeight] = useState(DOCK_DEFAULT_HEIGHT);
  const [mode, setMode] = useState<DockMode>("command");
  const [executeValue, setExecuteValue] = useState("");
  const [analyzeValue, setAnalyzeValue] = useState("");
  const [focusValue, setFocusValue] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<LocalAnalysisResult | null>(null);
  const [lastWasAgent, setLastWasAgent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState<CopilotStatus>("idle");
  const [lastResultMessage, setLastResultMessage] = useState<string | null>(null);

  const state = useSentinel();
  const dispatch = useSentinelDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const focusRunning = state.focusSession.state === "running";
  const focusPaused = state.focusSession.state === "paused";
  const defaultProjectId = state.selectedProjectId ?? state.projects[0]?.id ?? null;
  const defaultProjectName = state.projects.find((project) => project.id === defaultProjectId)?.name ?? undefined;

  const liveSuggestions = useMemo(
    () => buildLiveSuggestions(state.cards, state.selectedProjectId, defaultProjectName),
    [defaultProjectName, state.cards, state.selectedProjectId],
  );

  const firstProjectName = state.projects[0]?.name ?? "MiProyecto";
  const executeTabSuggestion = `crear tarea describir aquí en ${firstProjectName}`;
  const focusTabSuggestion = defaultProjectName ?? firstProjectName;

  const activeCard = useMemo(
    () => (state.selectedCardId ? state.cards.find((c) => c.id === state.selectedCardId) ?? null : null),
    [state.cards, state.selectedCardId],
  );

  const currentValue =
    mode === "command"
      ? executeValue
      : mode === "analyze"
        ? analyzeValue
        : mode === "focus"
          ? focusValue
          : "";

  const setCurrentValue = useCallback(
    (value: string) => {
      if (mode === "command") setExecuteValue(value);
      else if (mode === "analyze") setAnalyzeValue(value);
      else if (mode === "focus") setFocusValue(value);
    },
    [mode],
  );

  useEffect(() => {
    if (state.focusSession.state === "running") {
      intervalRef.current = setInterval(() => {
        dispatch({ type: "TICK_FOCUS" });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.focusSession.state, dispatch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DOCK_HEIGHT_STORAGE_KEY);
    if (!stored) return;
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) {
      setDockHeight(clampDockHeight(parsed));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DOCK_HEIGHT_STORAGE_KEY, String(dockHeight));
  }, [dockHeight]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setDockHeight((current) => clampDockHeight(current));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const runCommandLine = useCallback(
    (line: string): { success: boolean; message: string } => {
      const trimmed = line.trim();
      if (!trimmed) return { success: false, message: "Comando vacío" };
      const outcome = parseCommandLine(trimmed);

      if (!outcome.readyToExecute) {
        const detail = [
          ...outcome.helpLines,
          ...(outcome.exampleSnippets.length > 0
            ? ["", "Ejemplos:", ...outcome.exampleSnippets.map((s) => `· ${s}`)]
            : []),
        ].join("\n");
        dispatch({ type: "ADD_EVENT", event: createEvent("system", detail) });
        return { success: false, message: outcome.helpLines[0] ?? "Comando no reconocido" };
      }

      const result = executeCommandWithDispatch(
        outcome.parsed,
        state.cards,
        state.projects,
        dispatch,
        outcome.parsed.action === "unknown"
          ? { intentGuess: outcome.intent === "analyze" ? undefined : outcome.intent }
          : undefined,
      );

      fetch("/api/dock-commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: outcome.parsed.action,
          target: outcome.parsed.target ?? undefined,
          project: outcome.parsed.project ?? undefined,
          value: outcome.parsed.value ?? undefined,
          raw: trimmed,
          success: result.success,
          resultMessage: result.message,
        }),
      }).catch(() => {});

      if (result.success) {
        dispatch({ type: "ADD_EVENT", event: createEvent("command", result.message) });
        return { success: true, message: result.message };
      }

      const detail = result.hints?.length
        ? `${result.message}\n\n${result.hints.map((h) => `· ${h}`).join("\n")}`
        : result.message;
      dispatch({ type: "ADD_EVENT", event: createEvent("system", detail) });
      return { success: false, message: result.message };
    },
    [state.cards, state.projects, dispatch],
  );

  const runAnalyzeSubmit = useCallback(
    async (text: string): Promise<{ success: boolean; message: string }> => {
      setAnalyzing(true);

      try {
        const res = await fetch("/api/agents/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent: "planner",
            input: { task: text, context: "sentinel-board", constraints: "patch minimo" },
          }),
        });

        const json = await res.json();

        const tryNormalize = (data: unknown) => {
          if (!data) return null;
          return normalizePlannerResponse(data);
        };

        const planner =
          tryNormalize(json.parsed) ??
          (json.ok && json.rawText ? tryNormalize(safeParseJSON(json.rawText)) : null);

        if (planner) {
          const result = plannerToLocalAnalysis(planner, text);
          setLastAnalysis(result);
          setLastWasAgent(true);

          const providerLabel =
            json.provider === "ollama"
              ? "Planner ejecutado con Ollama"
              : json.provider === "openrouter"
                ? "Planner ejecutado con OpenRouter"
                : `Planner (${json.provider ?? "agente"})`;

          dispatch({
            type: "ADD_EVENT",
            event: createEvent(
              "heo_suggestion",
              `${providerLabel} · ${result.sourcePreview || "contexto"}`,
            ),
          });
          setAnalyzing(false);
          return { success: true, message: providerLabel };
        }

        const errDetail = json.error || "Respuesta no estructurada";
        dispatch({
          type: "ADD_EVENT",
          event: createEvent("system", `Agente planner: ${errDetail} — fallback heuristico activado.`),
        });
      } catch (err) {
        dispatch({
          type: "ADD_EVENT",
          event: createEvent(
            "system",
            `Error de red al llamar planner: ${err instanceof Error ? err.message : "desconocido"} — fallback heuristico activado.`,
          ),
        });
      }

      const result = runLocalAnalysis(text);
      setLastAnalysis(result);
      setLastWasAgent(false);
      dispatch({
        type: "ADD_EVENT",
        event: createEvent(
          "heo_suggestion",
          `Fallback heuristico activado · ${result.sourcePreview || "contexto"}`,
        ),
      });
      setAnalyzing(false);
      return { success: true, message: "Análisis local (fallback heurístico)" };
    },
    [dispatch],
  );

  const handleCopilotSubmit = useCallback(async () => {
    const value = currentValue.trim();
    if (!value) return;
    if (mode === "agents") return;

    setCopilotStatus("running");
    setLastResultMessage(null);

    try {
      if (mode === "command") {
        const { success, message } = runCommandLine(value);
        setCopilotStatus(success ? "success" : "error");
        setLastResultMessage(message);
        if (success) setExecuteValue("");
      } else if (mode === "analyze") {
        setExpanded(true);
        const { success, message } = await runAnalyzeSubmit(value);
        setCopilotStatus(success ? "success" : "error");
        setLastResultMessage(message);
        if (success) setAnalyzeValue("");
      } else if (mode === "focus") {
        const outcome = parseCommandLine(value);
        const line =
          outcome.readyToExecute && outcome.parsed.action !== "unknown"
            ? value
            : `iniciar foco en ${value}`;
        const { success, message } = runCommandLine(line);
        setCopilotStatus(success ? "success" : "error");
        setLastResultMessage(message);
        if (success) setFocusValue("");
      }
    } catch (err) {
      setCopilotStatus("error");
      setLastResultMessage(err instanceof Error ? err.message : "Error desconocido");
    }
  }, [currentValue, mode, runCommandLine, runAnalyzeSubmit]);

  const handleSuggestionPick = useCallback(
    (command: string) => {
      setMode("command");
      setExecuteValue("");
      setCopilotStatus("running");
      setLastResultMessage(null);
      const { success, message } = runCommandLine(command);
      setCopilotStatus(success ? "success" : "error");
      setLastResultMessage(message);
    },
    [runCommandLine],
  );

  const handleFocusStart = useCallback(() => {
    dispatch({ type: "START_FOCUS", project: defaultProjectName });
  }, [defaultProjectName, dispatch]);
  const handleFocusPause = useCallback(() => dispatch({ type: "PAUSE_FOCUS" }), [dispatch]);
  const handleFocusResume = useCallback(() => dispatch({ type: "RESUME_FOCUS" }), [dispatch]);
  const handleFocusEnd = useCallback(() => dispatch({ type: "END_FOCUS" }), [dispatch]);

  const notify = useCallback(
    (message: string) => {
      dispatch({ type: "ADD_EVENT", event: createEvent("system", message) });
    },
    [dispatch],
  );

  const expandIfCollapsed = useCallback(() => {
    if (!expanded) setExpanded(true);
  }, [expanded]);

  const stopResize = useCallback(() => {
    dragStateRef.current = null;
    setIsResizing(false);
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  useEffect(() => stopResize, [stopResize]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const nextHeight = clampDockHeight(dragState.startHeight + (dragState.startY - event.clientY));
      setDockHeight(nextHeight);
    };

    const handlePointerUp = () => {
      stopResize();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing, stopResize]);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const startHeight = expanded ? dockHeight : DOCK_DEFAULT_HEIGHT;
      if (!expanded) {
        setExpanded(true);
        setDockHeight(clampDockHeight(startHeight));
      }
      dragStateRef.current = { startY: event.clientY, startHeight };
      setIsResizing(true);
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    },
    [dockHeight, expanded],
  );

  const copilotAssist = useMemo<CopilotInputAssist | null>(() => {
    if (mode === "command") {
      const v = executeValue.trim();
      if (!v) return null;
      const outcome = parseCommandLine(v);
      if (!outcome.readyToExecute) {
        return { tone: "warning", lines: outcome.helpLines.slice(0, 2) };
      }
      if (outcome.parsed.action !== "unknown") {
        return {
          tone: "ready",
          lines: [`${LIVE_INTENT_ES[outcome.intent]} — reconocido · Enter para ejecutar`],
        };
      }
      return {
        tone: "muted",
        lines: [
          outcome.intent !== "unknown"
            ? `Pista: ${LIVE_INTENT_ES[outcome.intent]} · Enter intentará ejecutar`
            : "Enter ejecuta; si no encaja un patrón verás formatos sugeridos en el Timeline.",
        ],
      };
    }
    if (mode === "focus") {
      const v = focusValue.trim();
      if (!v) return null;
      return {
        tone: "ready",
        lines: [`Iniciar foco en «${v}» — Enter para confirmar`],
      };
    }
    return null;
  }, [mode, executeValue, focusValue]);

  const copilotFooterHint = useMemo(() => {
    if (mode === "command") return COMMAND_FORMAT_HINT;
    if (mode === "analyze") return ANALYZE_FOOTER_HINT;
    if (mode === "focus") return FOCUS_FOOTER_HINT;
    return RUNTIME_FOOTER_HINT;
  }, [mode]);

  const copilotRunning = (mode === "analyze" && analyzing) || copilotStatus === "running";

  const focusChipState = focusRunning ? "running" : focusPaused ? "paused" : "idle";
  const dockHeightStyle = expanded ? dockHeight : DOCK_COLLAPSED_HEIGHT;

  const statusBadgeLabel = copilotRunning ? "running" : STATUS_LABEL[copilotStatus];
  const statusBadgeClass = copilotRunning ? STATUS_CLASS.running : STATUS_CLASS[copilotStatus];

  return (
    <>
      <div
        className={cn(
          "sentinel-command-dock flex shrink-0 flex-col border-t border-border/35",
          !isResizing && "transition-[height] duration-200 ease-out",
        )}
        role="region"
        aria-label="HEO Copilot"
        style={{ height: dockHeightStyle }}
      >
        <button
          type="button"
          onPointerDown={handleResizeStart}
          className={cn(
            "group flex h-3 shrink-0 cursor-ns-resize items-center justify-center border-b border-border/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40",
            expanded ? "hover:bg-white/[0.03]" : "opacity-70 hover:opacity-100",
          )}
          aria-label="Redimensionar HEO Copilot"
        >
          <span className="h-1 w-14 rounded-full bg-border/70 transition-colors group-hover:bg-muted-foreground/70" />
        </button>

        <div className="flex min-h-9 shrink-0 items-center gap-2 border-b border-border/30 px-1 py-0.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground/70 transition-colors hover:text-foreground/85 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
            aria-label={expanded ? "Colapsar HEO Copilot" : "Expandir HEO Copilot"}
            aria-expanded={expanded}
            title={expanded ? "Colapsar (mostrar solo barra)" : "Expandir HEO Copilot"}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            <span className="text-[11px] font-semibold tracking-tight text-foreground/85">
              HEO Copilot
            </span>
          </button>

          {expanded ? (
            <>
              <DockModeTabs active={mode} onChange={setMode} />

              <div className="ml-2 hidden min-w-0 flex-1 flex-col leading-tight sm:flex">
                <span className="truncate text-[11px] font-semibold tracking-tight text-foreground/85">
                  {MODE_TITLES[mode]}
                </span>
                <span className="truncate text-[10px] text-muted-foreground/70">
                  {lastResultMessage
                    ? lastResultMessage
                    : `${MODE_HINTS[mode]} · Altura ${dockHeight}px`}
                </span>
              </div>
            </>
          ) : (
            <span className="ml-1 truncate text-[11px] uppercase tracking-wider text-muted-foreground/70">
              {mode === "command" ? "Execute" : mode === "analyze" ? "Analyze" : mode === "focus" ? "Focus" : "Runtime"}
            </span>
          )}

          <span
            className={cn(
              "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
              statusBadgeClass,
            )}
            aria-live="polite"
            title="Estado del último comando del HEO Copilot"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                copilotRunning
                  ? "bg-amber-400/85 animate-pulse"
                  : copilotStatus === "success"
                    ? "bg-emerald-400/80"
                    : copilotStatus === "error"
                      ? "bg-red-400/85"
                      : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            {statusBadgeLabel}
          </span>

          {expanded && (
            <button
              type="button"
              onClick={() => setMode("focus")}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-mono tabular-nums transition-colors",
                focusChipState === "running"
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15"
                  : focusChipState === "paused"
                    ? "border-border/40 bg-muted/40 text-muted-foreground hover:text-foreground/80"
                    : "border-border/35 bg-background/40 text-muted-foreground/70 hover:text-foreground/70",
              )}
              title="Abrir modo Focus"
              aria-label={`Foco ${focusChipState}, abrir modo Focus`}
            >
              <Clock className="h-3 w-3" />
              {formatChipElapsed(state.focusSession.elapsed)}
              {focusChipState === "paused" && <span className="text-[9px] uppercase">pausa</span>}
            </button>
          )}
        </div>

        {expanded && (
          <div
            id={`sentinel-dock-panel-${mode}`}
            role="tabpanel"
            aria-labelledby={`sentinel-dock-tab-${mode}`}
            className="sentinel-dock-expanded flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              {mode === "command" && (
                <CommandMode
                  liveSuggestions={liveSuggestions}
                  onSuggestionPick={handleSuggestionPick}
                  onOpenCreateTask={() => {
                    setCreateOpen(true);
                    setExpanded(true);
                  }}
                  onOpenMoveState={() => {
                    setMoveOpen(true);
                    setExpanded(true);
                  }}
                  onFocusStart={handleFocusStart}
                  onFocusEnd={handleFocusEnd}
                  focusRunning={focusRunning}
                />
              )}

              {mode === "analyze" && (
                <AnalyzeMode
                  analyzing={analyzing}
                  lastAnalysis={lastAnalysis}
                  lastWasAgent={lastWasAgent}
                  cards={state.cards}
                  projectId={defaultProjectId}
                  projectName={defaultProjectName}
                  onNotify={notify}
                />
              )}

              {mode === "focus" && (
                <FocusMode
                  session={state.focusSession}
                  activeCard={activeCard}
                  projectName={defaultProjectName}
                  onStart={handleFocusStart}
                  onPause={handleFocusPause}
                  onResume={handleFocusResume}
                  onEnd={handleFocusEnd}
                />
              )}

              {mode === "agents" && <AgentsMode expanded={expanded} />}
            </div>

            <CopilotInput
              mode={mode}
              value={currentValue}
              onChange={setCurrentValue}
              onSubmit={handleCopilotSubmit}
              onFocus={expandIfCollapsed}
              running={copilotRunning}
              assist={copilotAssist}
              tabSuggestion={
                mode === "command"
                  ? executeTabSuggestion
                  : mode === "focus"
                    ? focusTabSuggestion
                    : undefined
              }
              footerHint={copilotFooterHint}
            />
          </div>
        )}
      </div>

      <CreateTaskModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectId={defaultProjectId}
      />
      <MoveStateModal open={moveOpen} onOpenChange={setMoveOpen} />
    </>
  );
}
