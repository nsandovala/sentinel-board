"use client";

import { useSentinelDispatch } from "@/lib/state/sentinel-store";
import { useToast } from "@/components/ui/toast";
import { createEvent } from "@/lib/state/sentinel-reducer";
import { findExistingAnalysisDuplicate, nextCardId } from "@/lib/console/command-executor";
import {
  areTaskTitlesDuplicateOrSimilar,
  type LocalAnalysisResult,
} from "@/lib/console/local-analysis";
import type { SentinelCard } from "@/types/card";

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

interface AnalysisPreviewProps {
  data: LocalAnalysisResult;
  cards: SentinelCard[];
  projectId: string | null;
  projectName?: string;
  onNotify: (message: string) => void;
  isAgentResult?: boolean;
}

export function AnalysisPreview({
  data,
  cards,
  projectId,
  projectName,
  onNotify,
  isAgentResult,
}: AnalysisPreviewProps) {
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
