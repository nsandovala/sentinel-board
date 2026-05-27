"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Clock, Maximize2, Minimize2 } from "lucide-react";

import { CreateTaskModal } from "@/components/modals/create-task-modal";
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

import { DockModeTabs } from "./dock-mode-tabs";
import { CommandMode } from "./command-mode";
import { AnalyzeMode } from "./analyze-mode";
import { FocusMode } from "./focus-mode";
import { AgentsMode } from "./agents-mode";
import { CopilotInput, type CopilotInputAssist } from "./copilot-input";
import type { CopilotOutputState } from "./copilot-output";
import { askCopilot } from "@/lib/console/copilot-client";
import type { CopilotCardContext } from "@/lib/server/copilot-prompt";
import {
  useDock,
  clampExpandedHeight,
  DOCK_EXPANDED_MIN,
} from "./dock-context";

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
  "Runtime observa eventos NDJSON de AMON Agents. No recibe comandos.";

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
      text: `Desbloquear «${blocked.title}»`,
      command: `mover "${blocked.title}" a clarificando`,
    });
  }

  const backlog = scoped.find((card) => card.status === "idea_bruta");
  if (backlog) {
    suggestions.push({
      id: `heo-backlog-${backlog.id}`,
      text: `Clarificar «${backlog.title}»`,
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
      text: `Avanzar «${inFlight.title}» a ${nextStatus}`,
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

const MODE_SHORT_LABEL: Record<string, string> = {
  command: "Execute",
  analyze: "Analyze",
  focus: "Focus",
  agents: "Runtime",
};

type CopilotStatus = "idle" | "running" | "success" | "error";

const PROVIDER_LABEL: Record<string, string> = {
  ollama: "Ollama",
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
  heuristic: "Heurístico",
};

export function DockWorkspace() {
  const {
    hydrated,
    dockState,
    dockMode: mode,
    effectiveHeight,
    expandedHeight,
    setDockMode,
    setDockState,
    setExpandedHeight,
    toggleCollapsed,
    toggleSize,
    lastProvider,
    setLastProvider,
  } = useDock();

  const expanded = dockState !== "collapsed";

  const [executeValue, setExecuteValue] = useState("");
  const [analyzeValue, setAnalyzeValue] = useState("");
  const [focusValue, setFocusValue] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<LocalAnalysisResult | null>(null);
  const [lastWasAgent, setLastWasAgent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState<CopilotStatus>("idle");
  const [lastResultMessage, setLastResultMessage] = useState<string | null>(null);
  const [copilotOutput, setCopilotOutput] = useState<CopilotOutputState>({
    phase: "idle",
    provider: null,
    text: "",
    suggestedCommand: null,
    errorMessage: null,
    question: null,
  });
  const copilotAbortRef = useRef<AbortController | null>(null);

  const state = useSentinel();
  const dispatch = useSentinelDispatch();
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

  const firstProjectName = state.projects[0]?.name ?? null;
  // Tab solo completa cuando hay un proyecto real: deja el cursor listo
  // después de "crear tarea " para que el usuario sólo escriba el título.
  const executeTabSuggestion = firstProjectName
    ? `crear tarea  en ${firstProjectName}`
    : undefined;
  const focusTabSuggestion = defaultProjectName ?? firstProjectName ?? undefined;

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
          if (typeof json.provider === "string") setLastProvider(json.provider);

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
      setLastProvider("heuristic");
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
    [dispatch, setLastProvider],
  );

  const buildCardContext = useCallback(
    (card: SentinelCard | null): CopilotCardContext | undefined => {
      if (!card) return undefined;
      const projectName = state.projects.find((p) => p.id === card.projectId)?.name;
      return {
        id: card.id,
        title: card.title,
        description: card.description,
        status: card.status,
        priority: card.priority,
        projectName,
        tags: card.tags,
        checklist: card.checklist?.map((it) => ({ text: it.text, status: it.status })),
        blocked: card.blocked,
        blockerReason: card.blockerReason,
      };
    },
    [state.projects],
  );

  const runCopilotAsk = useCallback(
    async (question: string): Promise<{ success: boolean; message: string }> => {
      // Cancel any in-flight ask so the visible state reflects the latest turn only.
      copilotAbortRef.current?.abort();
      const controller = new AbortController();
      copilotAbortRef.current = controller;

      setCopilotOutput({
        phase: "thinking",
        provider: null,
        text: "",
        suggestedCommand: null,
        errorMessage: null,
        question,
      });

      // Tiny delay-less transition: switch to "consulting" so the user sees both phases.
      setCopilotOutput((prev) => ({ ...prev, phase: "consulting" }));

      const reply = await askCopilot(
        {
          message: question,
          card: buildCardContext(activeCard),
          projectName: defaultProjectName,
        },
        controller.signal,
      );

      if (controller.signal.aborted) {
        return { success: false, message: "Solicitud cancelada" };
      }

      if (reply.ok) {
        if (reply.provider && reply.provider !== "none") {
          setLastProvider(reply.provider);
        }
        setCopilotOutput({
          phase: "done",
          provider: reply.provider,
          text: reply.text,
          suggestedCommand: reply.suggestedCommand,
          errorMessage: null,
          question,
        });
        dispatch({
          type: "ADD_EVENT",
          event: createEvent(
            "heo_suggestion",
            `HEO Copilot (${reply.provider}) respondió a: ${question.slice(0, 120)}${
              question.length > 120 ? "…" : ""
            }`,
          ),
        });
        return {
          success: true,
          message: `HEO respondió via ${reply.provider}`,
        };
      }

      setCopilotOutput({
        phase: "error",
        provider: reply.provider,
        text: "",
        suggestedCommand: null,
        errorMessage:
          reply.error ?? "Ningún provider IA respondió. Revisa configuración.",
        question,
      });
      dispatch({
        type: "ADD_EVENT",
        event: createEvent(
          "system",
          `HEO Copilot: sin respuesta del AI router (${reply.error ?? "sin detalle"}).`,
        ),
      });
      return { success: false, message: reply.error ?? "Sin respuesta del AI router" };
    },
    [activeCard, buildCardContext, defaultProjectName, dispatch, setLastProvider],
  );

  const dismissCopilotOutput = useCallback(() => {
    copilotAbortRef.current?.abort();
    setCopilotOutput({
      phase: "idle",
      provider: null,
      text: "",
      suggestedCommand: null,
      errorMessage: null,
      question: null,
    });
  }, []);

  const handleCopilotSubmit = useCallback(async () => {
    const value = currentValue.trim();
    if (!value) return;
    if (mode === "agents") return;

    setCopilotStatus("running");
    setLastResultMessage(null);

    try {
      if (mode === "command") {
        const outcome = parseCommandLine(value);
        // Parser-recognized commands stay deterministic. Anything the parser
        // can't classify is forwarded to HEO Copilot via the AI router so the
        // dock keeps its conversational behaviour without an xterm panel.
        if (outcome.readyToExecute && outcome.parsed.action !== "unknown") {
          const { success, message } = runCommandLine(value);
          setCopilotStatus(success ? "success" : "error");
          setLastResultMessage(message);
          if (success) setExecuteValue("");
        } else {
          if (dockState === "collapsed") setDockState("compact");
          const { success, message } = await runCopilotAsk(value);
          setCopilotStatus(success ? "success" : "error");
          setLastResultMessage(message);
          if (success) setExecuteValue("");
        }
      } else if (mode === "analyze") {
        if (dockState !== "expanded") setDockState("expanded");
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
  }, [
    currentValue,
    mode,
    runCommandLine,
    runAnalyzeSubmit,
    runCopilotAsk,
    dockState,
    setDockState,
  ]);

  const handleSuggestionPick = useCallback(
    (command: string) => {
      setDockMode("command");
      setExecuteValue("");
      setCopilotStatus("running");
      setLastResultMessage(null);
      const { success, message } = runCommandLine(command);
      setCopilotStatus(success ? "success" : "error");
      setLastResultMessage(message);
    },
    [runCommandLine, setDockMode],
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
    if (dockState === "collapsed") setDockState("compact");
  }, [dockState, setDockState]);

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
      setExpandedHeight(
        clampExpandedHeight(dragState.startHeight + (dragState.startY - event.clientY)),
      );
    };

    const handlePointerUp = () => stopResize();

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing, stopResize, setExpandedHeight]);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      // Dragging the handle always works in the expanded state — promote
      // from collapsed/compact so the drag has somewhere to grow.
      const startHeight =
        dockState === "expanded"
          ? expandedHeight
          : clampExpandedHeight(expandedHeight || DOCK_EXPANDED_MIN);
      if (dockState !== "expanded") {
        setDockState("expanded");
        setExpandedHeight(startHeight);
      }
      dragStateRef.current = { startY: event.clientY, startHeight };
      setIsResizing(true);
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    },
    [dockState, expandedHeight, setDockState, setExpandedHeight],
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

  const copilotAsking =
    copilotOutput.phase === "thinking" || copilotOutput.phase === "consulting";
  const copilotRunning =
    (mode === "analyze" && analyzing) || copilotStatus === "running" || copilotAsking;
  const focusChipState = focusRunning ? "running" : focusPaused ? "paused" : "idle";
  const providerLabel = lastProvider ? PROVIDER_LABEL[lastProvider] ?? lastProvider : null;

  return (
    <>
      <div
        className={cn(
          "sentinel-command-dock flex shrink-0 flex-col border-t border-neutral-900",
          hydrated && !isResizing && "transition-[height] duration-200 ease-out",
        )}
        role="region"
        aria-label="HEO Copilot"
        style={{ height: effectiveHeight }}
      >
        {/* Resize handle — matte, contraste suficiente sin línea brillante. */}
        <button
          type="button"
          onPointerDown={handleResizeStart}
          className={cn(
            "group flex h-3 shrink-0 cursor-ns-resize items-center justify-center border-b border-neutral-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40",
            expanded ? "hover:bg-white/[0.03]" : "opacity-90 hover:opacity-100",
          )}
          aria-label="Redimensionar HEO Copilot"
        >
          <span className="h-[3px] w-12 rounded-full bg-neutral-700/70 transition-colors group-hover:bg-neutral-500/80" />
        </button>

        {/* Header */}
        <div className="flex min-h-9 shrink-0 items-center gap-2 border-b border-neutral-900 px-2 py-1">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground/70 transition-colors hover:text-foreground/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
            aria-label={expanded ? "Contraer HEO Copilot" : "Abrir HEO Copilot"}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            <span className="text-[11px] font-semibold tracking-tight text-foreground/90">
              HEO Copilot
            </span>
          </button>

          {expanded ? (
            <DockModeTabs active={mode} onChange={setDockMode} />
          ) : (
            <span className="ml-1 truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground/65">
              {MODE_SHORT_LABEL[mode]}
            </span>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* Status dot */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-white/[0.05] bg-[#151515] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                copilotRunning
                  ? "text-amber-300"
                  : copilotStatus === "success"
                    ? "text-emerald-300"
                    : copilotStatus === "error"
                      ? "text-red-300"
                      : "text-muted-foreground/70",
              )}
              aria-live="polite"
              title={lastResultMessage ?? "Estado del último comando del HEO Copilot"}
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
              {copilotRunning ? "running" : copilotStatus === "success" ? "ok" : copilotStatus}
            </span>

            {/* Provider — only shown once an analyze run reports one. */}
            {providerLabel && (
              <span
                className="hidden items-center rounded-md border border-white/[0.05] bg-[#151515] px-2 py-0.5 font-mono text-[10px] text-muted-foreground/70 sm:inline-flex"
                title="Provider IA de la última ejecución"
              >
                {providerLabel}
              </span>
            )}

            {/* Focus timer chip — only when a session exists */}
            {expanded && focusChipState !== "idle" && (
              <button
                type="button"
                onClick={() => setDockMode("focus")}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] tabular-nums transition-colors",
                  focusChipState === "running"
                    ? "border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15"
                    : "border-white/[0.05] bg-[#151515] text-muted-foreground hover:text-foreground/80",
                )}
                title="Abrir modo Focus"
                aria-label={`Foco ${focusChipState}, abrir modo Focus`}
              >
                <Clock className="h-3 w-3" />
                {formatChipElapsed(state.focusSession.elapsed)}
                {focusChipState === "paused" && <span className="text-[9px] uppercase">pausa</span>}
              </button>
            )}

            {/* Compact <-> expanded toggle */}
            {expanded && (
              <button
                type="button"
                onClick={toggleSize}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.05] bg-[#151515] text-muted-foreground/70 transition-colors hover:text-foreground/90"
                aria-label={dockState === "expanded" ? "Modo compacto" : "Modo expandido"}
                title={dockState === "expanded" ? "Compactar" : "Expandir"}
              >
                {dockState === "expanded" ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
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
                  onOpenCreateTask={() => setCreateOpen(true)}
                  onFocusStart={handleFocusStart}
                  onFocusEnd={handleFocusEnd}
                  focusRunning={focusRunning}
                  copilotOutput={copilotOutput}
                  onApplyCopilotSuggestion={(command) => {
                    setExecuteValue(command);
                    dismissCopilotOutput();
                  }}
                  onDismissCopilotOutput={dismissCopilotOutput}
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

            {mode !== "agents" && (
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
            )}
          </div>
        )}
      </div>

      <CreateTaskModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectId={defaultProjectId}
      />
    </>
  );
}
