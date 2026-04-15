"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

import {
  CommandInput,
  AnalyzeDockInput,
  type DockInputMode,
  type LiveCommandFeedback,
} from "./command-input";
import { CommandLog } from "./command-log";
import { CommandSuggestions } from "./command-suggestions";
import { FocusTimer } from "./focus-timer";
import { QuickActions } from "./quick-actions";
import { CreateTaskModal } from "@/components/modals/create-task-modal";
import { MoveStateModal } from "@/components/modals/move-state-modal";

import { parseCommandLine, type CommandIntent } from "@/lib/console/command-parser";
import {
  executeCommandWithDispatch,
  findExistingAnalysisDuplicate,
  nextCardId,
} from "@/lib/console/command-executor";
import { areTaskTitlesDuplicateOrSimilar } from "@/lib/console/local-analysis";
import { mockSuggestions } from "@/lib/console/mock-events";
import { createEvent } from "@/lib/state/sentinel-reducer";
import { runLocalAnalysis, type LocalAnalysisResult } from "@/lib/console/local-analysis";
import {
  safeParseJSON,
  normalizePlannerResponse,
  plannerToLocalAnalysis,
} from "@/lib/agents/parse-planner-response";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";
import type { SentinelCard } from "@/types/card";

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

const ANALYZE_EXAMPLES = [
  "Pegar bullet list de un correo",
  "Pegar párrafo de riesgos y próximos pasos",
] as const;

const ANALYZE_MODE_HINT =
  "Heurístico local (sin red): abajo podés crear tarjetas en backlog o copiar el informe.";

function buildAnalysisBacklogCard(title: string, projectId: string): SentinelCard {
  const t = title.replace(/\s+/g, " ").trim().slice(0, 200) || "Tarea desde análisis";
  return {
    id: nextCardId(),
    title: t,
    status: "idea_bruta",
    type: "task",
    priority: "medium",
    tags: ["análisis-local"],
    projectId,
    checklist: [],
    blocked: false,
  };
}

function formatAnalysisExport(data: LocalAnalysisResult): string {
  const cl = data.codexLoop;
  const blocks: string[] = [
    "══ Resumen ══",
    data.summary,
    "",
    "══ Tareas sugeridas (accionables) ══",
    ...data.tasks.map((t, i) => `${i + 1}. ${t}`),
    "",
    "══ Riesgos ══",
    ...data.risks.map((r, i) => `${i + 1}. ${r}`),
    "",
    "══ Próximos pasos ══",
    ...data.nextSteps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "══ Codex Loop (borrador) ══",
    `Problema: ${cl.problem?.trim() || "—"}`,
    `Objetivo: ${cl.objective?.trim() || "—"}`,
    `Hipótesis: ${cl.hypothesis?.trim() || "—"}`,
    `Solución: ${cl.solution?.trim() || "—"}`,
    `Validación: ${cl.validation?.trim() || "—"}`,
    `Siguiente paso: ${cl.nextStep?.trim() || "—"}`,
  ];
  return blocks.join("\n");
}

function AnalysisPreview({
  data,
  cards,
  projectId,
  projectName,
  onNotify,
  isAgentResult,
}: {
  data: LocalAnalysisResult;
  cards: SentinelCard[];
  projectId: string | null;
  projectName?: string;
  onNotify: (message: string) => void;
  isAgentResult?: boolean;
}) {
  const { toast } = useToast();
  const cl = data.codexLoop;
  const loopFields: { label: string; value?: string }[] = [
    { label: "Problema", value: cl.problem },
    { label: "Objetivo", value: cl.objective },
    { label: "Hipótesis", value: cl.hypothesis },
    { label: "Solución", value: cl.solution },
    { label: "Validación", value: cl.validation },
    { label: "Siguiente paso", value: cl.nextStep },
  ];

  const canAct = Boolean(projectId);
  const dispatch = useSentinelDispatch();

  const logSkip = (line: string) => {
    dispatch({ type: "ADD_EVENT", event: createEvent("system", line) });
  };

  const copyAll = async (e: React.MouseEvent) => {
    try {
      await navigator.clipboard.writeText(formatAnalysisExport(data));
      onNotify("Informe copiado al portapapeles (resumen, tareas, riesgos, pasos, Codex).");
      toast("Informe copiado", "success", e);
    } catch {
      toast("Error al copiar", "error", e);
    }
  };

  const addOne = (title: string) => {
    if (!projectId) {
      onNotify("No hay proyecto: no se puede crear la tarjeta.");
      return;
    }
    const trimmed = title.replace(/\s+/g, " ").trim();
    const existing = findExistingAnalysisDuplicate(cards, trimmed, projectId);
    if (existing) {
      logSkip(
        `Análisis: omitida creación — «${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}» ya existe o es muy parecida a «${existing.title}».`,
      );
      onNotify("No se creó: duplicado o casi igual a una tarjeta del proyecto (detalle en registro).");
      return;
    }
    dispatch({ type: "CREATE_CARD", card: buildAnalysisBacklogCard(trimmed, projectId) });
    onNotify(`Tarjeta añadida al backlog (idea bruta)${projectName ? ` en «${projectName}»` : ""}.`);
  };

  const addAllTasks = () => {
    if (!projectId) {
      onNotify("No hay proyecto: no se puede crear la tarjeta.");
      return;
    }
    const createdInBatch: string[] = [];
    let n = 0;
    for (const t of data.tasks) {
      const trimmed = t.replace(/\s+/g, " ").trim();
      if (!trimmed) continue;
      const onBoard = findExistingAnalysisDuplicate(cards, trimmed, projectId);
      if (onBoard) {
        logSkip(
          `Análisis: omitida — «${trimmed.slice(0, 72)}${trimmed.length > 72 ? "…" : ""}» coincide con «${onBoard.title}».`,
        );
        continue;
      }
      if (createdInBatch.some((prev) => areTaskTitlesDuplicateOrSimilar(prev, trimmed))) {
        logSkip(
          `Análisis: omitida en lote — «${trimmed.slice(0, 72)}${trimmed.length > 72 ? "…" : ""}» duplicada respecto a otra propuesta ya creada en esta acción.`,
        );
        continue;
      }
      dispatch({ type: "CREATE_CARD", card: buildAnalysisBacklogCard(trimmed, projectId) });
      createdInBatch.push(trimmed);
      n++;
    }
    onNotify(
      n ? `${n} tarjeta(s) añadidas al backlog.` : "Ninguna tarea nueva: todas estaban duplicadas o vacías.",
    );
  };

  return (
    <div className="sentinel-glass-panel flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/75">
            Resultado · {isAgentResult ? "agente planner" : "heuristico local"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {isAgentResult
              ? "Respuesta via Ollama / OpenRouter · revisa y ejecuta acciones abajo"
              : "Sin modelo · revisa y ejecuta acciones abajo"}
          </p>
        </div>
        <button
          type="button"
          onClick={copyAll}
          className="shrink-0 rounded-md border border-border/40 bg-muted/90 px-2 py-1 text-[10px] font-medium text-foreground/85 shadow-[inset_0_1px_0_oklch(0.62_0.014_285/0.06)] transition-colors hover:bg-muted"
        >
          Copiar informe
        </button>
      </div>

      <section className="sentinel-analysis-rail rounded-r-md pl-2.5 pr-1 py-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          1 · Resumen ejecutivo
        </h4>
        <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/90">{data.summary}</p>
      </section>

      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          2 · Próximos pasos (orden sugerido)
        </h4>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[12px] text-foreground/85">
          {data.nextSteps.map((s, i) => (
            <li key={i} className="leading-snug">
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            3 · Tareas propuestas → backlog
          </h4>
          {data.tasks.length > 1 ? (
            <button
              type="button"
              disabled={!canAct}
              onClick={addAllTasks}
              title={!canAct ? "Falta proyecto en el tablero" : undefined}
              className="rounded-md border border-border/40 bg-muted/90 px-2 py-0.5 text-[10px] font-medium text-foreground/85 shadow-[inset_0_1px_0_oklch(0.6_0.014_285/0.05)] transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              Todas al backlog
            </button>
          ) : null}
        </div>
        {!canAct ? (
          <p className="text-[10px] text-muted-foreground">Necesitás al menos un proyecto en el tablero para crear tarjetas.</p>
        ) : null}
        <ul className="mt-1 space-y-1.5">
          {data.tasks.map((t, i) => (
            <li
              key={`${i}-${t.slice(0, 24)}`}
              className="sentinel-glass-panel--subtle flex flex-col gap-1 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-[12px] leading-snug text-foreground/85">{t}</span>
              <button
                type="button"
                disabled={!canAct}
                onClick={() => addOne(t)}
                className="shrink-0 self-start rounded-md border border-border/35 bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground/80 shadow-[inset_0_1px_0_oklch(0.55_0.012_285/0.05)] transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-40 sm:self-center"
              >
                Crear en board
              </button>
            </li>
          ))}
        </ul>
        {data.tasks.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No se extrajeron ítems concretos; reintenta con viñetas o frases más cortas.</p>
        ) : null}
      </section>

      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          4 · Riesgos a vigilar
        </h4>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] text-foreground/78">
          {data.risks.map((r, i) => (
            <li key={i} className="leading-snug">
              {r}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border/30 pt-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          5 · Codex Loop (borrador)
        </h4>
        <dl className="mt-1.5 space-y-1.5 text-[11px] text-foreground/75">
          {loopFields.map((row) => (
            <div key={row.label} className="rounded-sm bg-muted/40 px-1.5 py-0.5">
              <dt className="font-medium text-muted-foreground">{row.label}</dt>
              <dd className="whitespace-pre-wrap pl-0.5">{row.value?.trim() ? row.value : "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export function CommandDock() {
  const [expanded, setExpanded] = useState(false);
  const [dockMode, setDockMode] = useState<DockInputMode>("command");
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

  const tabHints = useMemo(() => {
    const firstName = state.projects[0]?.name ?? "MiProyecto";
    return [
      `crear tarea describir aquí en ${firstName}`,
      `mover "título" a desarrollo`,
      `iniciar foco en ${firstName}`,
    ];
  }, [state.projects]);

  const commandLiveFeedback = useMemo((): LiveCommandFeedback | null => {
    if (!commandValue.trim()) return null;
    const outcome = parseCommandLine(commandValue);
    if (!outcome.readyToExecute) {
      return { tone: "warning", lines: outcome.helpLines.slice(0, 2) };
    }
    if (outcome.parsed.action !== "unknown") {
      return {
        tone: "ready",
        lines: [
          `${LIVE_INTENT_ES[outcome.intent]} — reconocido · Enter para ejecutar`,
        ],
      };
    }
    return {
      tone: "muted",
      lines: [
        outcome.intent !== "unknown"
          ? `Pista: ${LIVE_INTENT_ES[outcome.intent]} · Enter intentará ejecutar o mostrará ayuda en el registro`
          : "Enter ejecuta; si no encaja un patrón verás formatos sugeridos abajo en el registro.",
      ],
    };
  }, [commandValue]);

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
    dispatch({ type: "START_FOCUS" });
    fetch("/api/focus-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    }).catch(() => {});
  }, [dispatch]);

  const handleFocusEnd = useCallback(() => {
    const elapsed = state.focusSession.elapsed;
    dispatch({ type: "END_FOCUS" });
    fetch("/api/focus-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end", elapsedSeconds: elapsed }),
    }).catch(() => {});
  }, [dispatch, state.focusSession.elapsed]);

  const notify = useCallback(
    (message: string) => {
      dispatch({ type: "ADD_EVENT", event: createEvent("system", message) });
    },
    [dispatch],
  );

  const defaultProjectId = state.projects[0]?.id ?? null;
  const defaultProjectName = state.projects[0]?.name;

  return (
    <>
      <div
        className="sentinel-command-dock flex shrink-0 flex-col border-t border-border/35"
        role="region"
        aria-label="Command Dock"
      >
        <div
          className={cn(
            "flex gap-1 border-b border-border/30 px-1 py-1",
            dockMode === "analyze"
              ? "min-h-[56px] items-stretch"
              : "min-h-10 items-start py-0.5",
          )}
        >
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-10 w-10 shrink-0 items-center justify-center self-center text-muted-foreground/60 transition-colors hover:text-foreground/80"
            aria-label={expanded ? "Colapsar Command Dock" : "Expandir Command Dock"}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>

          <div className="sentinel-dock-segment flex shrink-0 self-center rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setDockMode("command")}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                dockMode === "command"
                  ? "sentinel-dock-segment-active text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Comando
            </button>
            <button
              type="button"
              onClick={() => setDockMode("analyze")}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                dockMode === "analyze"
                  ? "sentinel-dock-segment-active text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Analizar
            </button>
          </div>

          <div className="min-w-0 flex-1">
            {dockMode === "command" ? (
              <CommandInput
                value={commandValue}
                onChange={setCommandValue}
                onSubmit={handleCommandSubmit}
                onFocus={() => !expanded && setExpanded(true)}
                suggestions={tabHints}
                formatHint={expanded ? COMMAND_FORMAT_HINT : undefined}
                liveFeedback={commandLiveFeedback}
              />
            ) : (
              <AnalyzeDockInput
                value={analyzeValue}
                onChange={setAnalyzeValue}
                onSubmit={handleAnalyzeSubmit}
                onFocus={() => !expanded && setExpanded(true)}
                analyzeHint={expanded ? ANALYZE_MODE_HINT : undefined}
                analyzeExamples={expanded ? [...ANALYZE_EXAMPLES] : []}
              />
            )}
          </div>

          {dockMode === "analyze" && (
            <button
              type="button"
              onClick={handleAnalyzeSubmit}
              disabled={!analyzeValue.trim() || analyzing}
              className="sentinel-dock-segment mr-2 shrink-0 self-center rounded-md px-2.5 py-1 text-[11px] font-medium text-foreground/88 transition-colors hover:border-[oklch(0.5_0.014_285/0.28)] hover:shadow-[inset_0_1px_0_oklch(0.58_0.014_285/0.07)] disabled:opacity-40"
            >
              {analyzing ? "Analizando…" : "Analizar"}
            </button>
          )}

          <div className="sentinel-focus-chrome shrink-0 self-center pr-3">
            <div className="sentinel-focus-chrome-inner px-1.5 py-0.5">
              <FocusTimer
                session={state.focusSession}
                onStart={handleFocusStart}
                onEnd={handleFocusEnd}
              />
            </div>
          </div>
        </div>

        {expanded && (
          <div className="sentinel-dock-expanded grid grid-cols-[1fr_auto] gap-4 border-t border-border/30 px-4 pb-3 pt-2">
            <div className="flex max-h-72 min-h-0 flex-col gap-2 overflow-hidden">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Registro del dock
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <CommandLog />
              </div>
              {analyzing && dockMode === "analyze" && (
                <div className="flex items-center gap-2 border-t border-border/30 px-1 py-3">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground/70" />
                  <span className="text-[11px] text-muted-foreground">
                    Consultando agente planner…
                  </span>
                </div>
              )}
              {lastAnalysis && !analyzing && dockMode === "analyze" && (
                <div className="max-h-[min(22rem,55vh)] shrink-0 overflow-y-auto border-t border-border/30 pt-2">
                  <AnalysisPreview
                    data={lastAnalysis}
                    cards={state.cards}
                    projectId={defaultProjectId}
                    projectName={defaultProjectName}
                    onNotify={notify}
                    isAgentResult={lastWasAgent}
                  />
                </div>
              )}
            </div>

            <div className="flex w-56 flex-col gap-4">
              <CommandSuggestions suggestions={mockSuggestions} onSelect={runCommandLine} />
              <QuickActions
                onFocusStart={handleFocusStart}
                onFocusEnd={handleFocusEnd}
                onOpenCreateTask={() => {
                  setCreateOpen(true);
                  setExpanded(true);
                }}
                onOpenMoveState={() => {
                  setMoveOpen(true);
                  setExpanded(true);
                }}
                focusRunning={focusRunning}
              />
            </div>
          </div>
        )}
      </div>

      <CreateTaskModal open={createOpen} onOpenChange={setCreateOpen} />
      <MoveStateModal open={moveOpen} onOpenChange={setMoveOpen} />
    </>
  );
}
