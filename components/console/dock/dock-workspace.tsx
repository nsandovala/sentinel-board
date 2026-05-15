"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";

import { CreateTaskModal } from "@/components/modals/create-task-modal";
import { MoveStateModal } from "@/components/modals/move-state-modal";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";
import { createEvent } from "@/lib/state/sentinel-reducer";
import { parseCommandLine } from "@/lib/console/command-parser";
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
  command: "Workspace · Command",
  analyze: "Workspace · Analyze",
  focus: "Workspace · Focus",
  agents: "Workspace · Agents",
};

const MODE_HINTS: Record<DockMode, string> = {
  command: "Ejecuta comandos deterministas locales",
  analyze: "Convierte contexto en backlog accionable",
  focus: "Sesión de foco · timer y tarea activa",
  agents: "Estado mock — stream pendiente",
};

export function DockWorkspace() {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<DockMode>("command");
  const [commandValue, setCommandValue] = useState("");
  const [analyzeValue, setAnalyzeValue] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<LocalAnalysisResult | null>(null);
  const [lastWasAgent, setLastWasAgent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const state = useSentinel();
  const dispatch = useSentinelDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const focusRunning = state.focusSession.state === "running";
  const focusPaused = state.focusSession.state === "paused";
  const defaultProjectId = state.selectedProjectId ?? state.projects[0]?.id ?? null;
  const defaultProjectName = state.projects.find((project) => project.id === defaultProjectId)?.name ?? undefined;

  const liveSuggestions = useMemo(
    () => buildLiveSuggestions(state.cards, state.selectedProjectId, defaultProjectName),
    [defaultProjectName, state.cards, state.selectedProjectId],
  );

  const tabHints = useMemo(() => {
    const firstName = state.projects[0]?.name ?? "MiProyecto";
    return [
      `crear tarea describir aquí en ${firstName}`,
      `mover "título" a desarrollo`,
      `iniciar foco en ${firstName}`,
    ];
  }, [state.projects]);

  const activeCard = useMemo(
    () => (state.selectedCardId ? state.cards.find((c) => c.id === state.selectedCardId) ?? null : null),
    [state.cards, state.selectedCardId],
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

  const runCommandLine = useCallback(
    (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const outcome = parseCommandLine(trimmed);

      if (!outcome.readyToExecute) {
        const detail = [
          ...outcome.helpLines,
          ...(outcome.exampleSnippets.length > 0
            ? ["", "Ejemplos:", ...outcome.exampleSnippets.map((s) => `· ${s}`)]
            : []),
        ].join("\n");
        dispatch({ type: "ADD_EVENT", event: createEvent("system", detail) });
        return;
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
        return;
      }

      const detail = result.hints?.length
        ? `${result.message}\n\n${result.hints.map((h) => `· ${h}`).join("\n")}`
        : result.message;
      dispatch({ type: "ADD_EVENT", event: createEvent("system", detail) });
    },
    [state.cards, state.projects, dispatch],
  );

  const handleCommandSubmit = useCallback(() => {
    if (!commandValue.trim()) return;
    runCommandLine(commandValue);
    setCommandValue("");
  }, [commandValue, runCommandLine]);

  const handleAnalyzeSubmit = useCallback(async () => {
    const text = analyzeValue.trim();
    if (!text || analyzing) return;

    setAnalyzing(true);
    setExpanded(true);

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
        return;
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
  }, [analyzeValue, analyzing, dispatch]);

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

  const focusChipState = focusRunning ? "running" : focusPaused ? "paused" : "idle";

  return (
    <>
      <div
        className="sentinel-command-dock flex shrink-0 flex-col border-t border-border/35"
        role="region"
        aria-label="Workspace Panel"
      >
        <div className="flex min-h-10 items-center gap-2 border-b border-border/30 px-1 py-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground/80"
            aria-label={expanded ? "Colapsar Workspace Panel" : "Expandir Workspace Panel"}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>

          <DockModeTabs active={mode} onChange={setMode} />

          <div className="ml-2 hidden min-w-0 flex-1 flex-col leading-tight sm:flex">
            <span className="truncate text-[11px] font-semibold tracking-tight text-foreground/85">
              {MODE_TITLES[mode]}
            </span>
            <span className="truncate text-[10px] text-muted-foreground/70">
              {MODE_HINTS[mode]}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMode("focus")}
            className={cn(
              "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-mono tabular-nums transition-colors",
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
        </div>

        <div
          id={`sentinel-dock-panel-${mode}`}
          role="tabpanel"
          aria-labelledby={`sentinel-dock-tab-${mode}`}
          className="sentinel-dock-expanded"
        >
          {mode === "command" && (
            <CommandMode
              expanded={expanded}
              value={commandValue}
              onChange={setCommandValue}
              onSubmit={handleCommandSubmit}
              onFocus={expandIfCollapsed}
              onSuggestionPick={runCommandLine}
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
              tabHints={tabHints}
              liveSuggestions={liveSuggestions}
            />
          )}

          {mode === "analyze" && (
            <AnalyzeMode
              expanded={expanded}
              value={analyzeValue}
              onChange={setAnalyzeValue}
              onSubmit={handleAnalyzeSubmit}
              onFocus={expandIfCollapsed}
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
              expanded={expanded}
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
      </div>

      <CreateTaskModal open={createOpen} onOpenChange={setCreateOpen} />
      <MoveStateModal open={moveOpen} onOpenChange={setMoveOpen} />
    </>
  );
}
