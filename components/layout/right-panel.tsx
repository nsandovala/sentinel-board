"use client";

import { useCallback, useMemo } from "react";
import { Terminal, Cpu, Clock, Sparkles, Copy } from "lucide-react";
import { useSentinel } from "@/lib/state/sentinel-store";
import { eventRelatesToProject } from "@/lib/state/sentinel-reducer";
import { generateCodexLoop } from "@/lib/console/codex-loop-generator";
import { generateMoneyCode } from "@/lib/console/money-code-generator";
import { STATUS_LABELS } from "@/lib/console/status-labels";
import type { SentinelCard } from "@/types/card";
import type { Project } from "@/types/project";
import type { DockEvent, EventType } from "@/types/event";
import type { FocusSession } from "@/types/timer";
import type { CardStatus } from "@/types/enums";
import { cn } from "@/lib/utils";

const doneLike: CardStatus[] = ["listo", "produccion", "archivado"];

const eventIcons: Record<EventType, typeof Terminal> = {
  command: Terminal,
  system: Cpu,
  focus: Clock,
  heo_suggestion: Sparkles,
};

const eventColors: Record<EventType, string> = {
  command: "text-emerald-400/90",
  system: "text-muted-foreground",
  focus: "text-amber-400/85",
  heo_suggestion: "text-violet-400/85",
};

/** Trozo tipo literal numérico + resto (ej. `25 minutos` como en TS `25 as minutes`). */
function CmdDurationTokens({ text }: { text: string }) {
  const m = text.match(/^(\d+)(\s+)(.+)$/);
  if (m) {
    return (
      <>
        <span className="sentinel-cmd-num">{m[1]}</span>
        <span className="sentinel-cmd-muted">{m[2]}</span>
        <span className="sentinel-cmd-id">{m[3]}</span>
      </>
    );
  }
  return <span className="sentinel-cmd-str">{text}</span>;
}

/**
 * Sintaxis estilo editor (TS/Python): keywords en verde menta, strings/ids en lila,
 * puntuación apagada; tipografía siempre monoespaciada vía CSS en `.sentinel-command-snippet`.
 */
function DockCommandHighlighted({ command }: { command: string }) {
  const c = command.trim();

  /* mover("…", a, dest) — keyword, string, punct, identifier */
  const mover = c.match(/^(mover)(\s+)(["'])([\s\S]*?)\3(\s+a\s+)(.+)$/i);
  if (mover) {
    return (
      <>
        <span className="sentinel-cmd-kw">{mover[1]}</span>
        <span className="sentinel-cmd-muted">{mover[2]}</span>
        <span className="sentinel-cmd-str">
          {mover[3]}
          {mover[4]}
          {mover[3]}
        </span>
        <span className="sentinel-cmd-muted">{mover[5]}</span>
        <span className="sentinel-cmd-id">{mover[6]}</span>
      </>
    );
  }

  /* iniciar foco en Proyecto — dos keywords + target */
  const focus = c.match(/^(iniciar)(\s+)(foco)(\s+en\s+)(.+)$/i);
  if (focus) {
    return (
      <>
        <span className="sentinel-cmd-kw">{focus[1]}</span>
        <span className="sentinel-cmd-muted">{focus[2]}</span>
        <span className="sentinel-cmd-kw2">{focus[3]}</span>
        <span className="sentinel-cmd-muted">{focus[4]}</span>
        <span className="sentinel-cmd-arg">{focus[5]}</span>
      </>
    );
  }

  if (/^iniciar\s+foco$/i.test(c)) {
    const parts = c.split(/\s+/);
    return (
      <>
        <span className="sentinel-cmd-kw">{parts[0]}</span>
        <span className="sentinel-cmd-muted"> </span>
        <span className="sentinel-cmd-kw2">{parts[1]}</span>
      </>
    );
  }

  const reg = c.match(/^(registrar)(\s+)(.+?)(\s+en\s+)(.+)$/i);
  if (reg) {
    return (
      <>
        <span className="sentinel-cmd-kw">{reg[1]}</span>
        <span className="sentinel-cmd-muted">{reg[2]}</span>
        <CmdDurationTokens text={reg[3]} />
        <span className="sentinel-cmd-muted">{reg[4]}</span>
        <span className="sentinel-cmd-arg">{reg[5]}</span>
      </>
    );
  }

  return <span className="sentinel-cmd-target">{c}</span>;
}

function DockCommandSnippetBlock({ command }: { command: string }) {
  const copyCmd = useCallback(() => {
    void navigator.clipboard?.writeText?.(command);
  }, [command]);

  return (
    <div className="sentinel-command-snippet-host">
      <pre className="sentinel-command-snippet sentinel-command-snippet--syntax">
        <code>
          <DockCommandHighlighted command={command} />
        </code>
      </pre>
      <button
        type="button"
        onClick={copyCmd}
        className="sentinel-command-snippet-copy"
        aria-label="Copiar comando al portapapeles"
        title="Copiar comando"
      >
        <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      </button>
    </div>
  );
}

function formatEventTime(date: Date): string {
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function countActiveProjectCards(projectId: string, cards: SentinelCard[]): number {
  return cards.filter((c) => c.projectId === projectId && !doneLike.includes(c.status)).length;
}

function countBacklogProjectCards(projectId: string, cards: SentinelCard[]): number {
  return cards.filter(
    (c) => c.projectId === projectId && (c.status === "idea_bruta" || c.blocked),
  ).length;
}

function focusSummaryForProject(project: Project, session: FocusSession): string {
  if (session.state === "running" && session.project) {
    const same =
      session.project.trim().toLowerCase() === project.name.trim().toLowerCase();
    if (same) {
      const m = Math.floor(session.elapsed / 60);
      const s = session.elapsed % 60;
      return `Foco activo · ${m}m ${s}s en ${project.name}`;
    }
    return `Otro foco en curso: ${session.project}`;
  }
  return "Sin foco activo en este proyecto.";
}

function projectSuggestedNextStep(
  project: Project,
  cards: SentinelCard[],
  session: FocusSession,
): { explanation: string; command: string } {
  const pc = cards.filter((c) => c.projectId === project.id);
  const blocked = pc.find((c) => c.blocked);
  if (blocked) {
    return {
      explanation: `Desatascar «${blocked.title}» o moverla a clarificación.`,
      command: `mover "${blocked.title}" a clarificando`,
    };
  }
  const idea = pc.find((c) => c.status === "idea_bruta");
  if (idea) {
    return {
      explanation: `Convertí la idea bruta «${idea.title}» en trabajo clarificado.`,
      command: `mover "${idea.title}" a clarificando`,
    };
  }

  const focusHere =
    session.state === "running" &&
    session.project?.trim().toLowerCase() === project.name.trim().toLowerCase();

  if (!focusHere) {
    return {
      explanation: "Encadená un bloque corto de foco sobre este proyecto.",
      command: `iniciar foco en ${project.name}`,
    };
  }

  const inFlight = pc.find(
    (c) =>
      !doneLike.includes(c.status) &&
      c.status !== "idea_bruta" &&
      (c.status === "desarrollo" || c.status === "en_proceso" || c.status === "qa"),
  );
  if (inFlight) {
    return {
      explanation: `Avanzá «${inFlight.title}» o cerrá ítems de checklist pendientes.`,
      command: `mover "${inFlight.title}" a qa`,
    };
  }

  return {
    explanation: "Revisá el timeline filtrado y registrá tiempo al cerrar el bloque.",
    command: `registrar 25 minutos en ${project.name}`,
  };
}

function CodexLoopSection({ card }: { card: SentinelCard }) {
  const loop = generateCodexLoop(card);
  const steps = [
    { label: "Problema", value: loop.problem },
    { label: "Objetivo", value: loop.objective },
    { label: "Hipótesis", value: loop.hypothesis },
    { label: "Solución", value: loop.solution },
    { label: "Validación", value: loop.validation },
    { label: "Siguiente paso", value: loop.nextStep },
  ];

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/28 ring-1 ring-primary/12" />
        <h3 className="sentinel-rail-section-label">Codex Loop</h3>
      </div>
      <div className="sentinel-glass-panel p-3.5">
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s.label} className="flex gap-3 border-b border-border/25 pb-3 last:border-0 last:pb-0">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted/80 text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border/30">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <span className="sentinel-rail-meta block font-medium uppercase tracking-[0.06em]">
                  {s.label}
                </span>
                <p className="sentinel-rail-body mt-1">{s.value ?? "—"}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SuggestedNextActionSection({
  card,
  projectName,
}: {
  card: SentinelCard;
  projectName?: string;
}) {
  const loop = generateCodexLoop(card);
  const pendingCheck = card.checklist.filter((i) => i.status !== "done").length;

  let explanation: string;
  let command: string;

  if (card.blocked) {
    explanation = "Está bloqueada: aclara el bloqueo o muévela a clarificación para desatascar.";
    command = `mover "${card.title}" a clarificando`;
  } else if (card.status === "idea_bruta") {
    explanation = "Sigue en idea bruta: refiná el alcance o pasala a clarificando.";
    command = `mover "${card.title}" a clarificando`;
  } else if (pendingCheck > 0 && card.status !== "desarrollo" && card.status !== "qa") {
    explanation = `Hay ${pendingCheck} ítem(s) de checklist pendientes; acercala al trabajo activo.`;
    command = `mover "${card.title}" a desarrollo`;
  } else if (card.status === "qa" || card.status === "listo") {
    explanation = "En validación o listo: cerrá el ciclo o retrocedé si falta evidencia.";
    command = `mover "${card.title}" a produccion`;
  } else {
    explanation =
      loop.nextStep?.trim() ||
      "Usá foco breve sobre el proyecto y registrá tiempo al cerrar el bloque.";
    command = projectName ? `iniciar foco en ${projectName}` : "iniciar foco";
  }

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/25 ring-1 ring-primary/12" />
        <h3 className="sentinel-rail-section-label">Siguiente acción sugerida</h3>
      </div>
      <div className="sentinel-glass-panel p-3.5">
        <p className="sentinel-rail-body">{explanation}</p>
        <div className="sentinel-command-snippet-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            Comando sugerido
            <span className="ml-1.5 font-mono text-[9px] font-normal normal-case tracking-normal text-muted-foreground/65">
              (Command Dock)
            </span>
          </p>
          <DockCommandSnippetBlock command={command} />
        </div>
      </div>
    </section>
  );
}

function MoneyCodeSection({ card }: { card: SentinelCard }) {
  const mc = generateMoneyCode(card);
  const score = mc.score ?? 0;

  const dims = [
    { label: "Impacto", value: mc.impact },
    { label: "Urgencia", value: mc.urgency },
    { label: "Esfuerzo", value: mc.effort },
    { label: "Retorno", value: mc.returnValue },
    { label: "Estrategia", value: mc.strategyAlignment },
    { label: "Reuso", value: mc.reuseValue },
    { label: "Validación", value: mc.validationValue },
  ];

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/25 ring-1 ring-primary/12" />
        <h3 className="sentinel-rail-section-label">Código del Dinero</h3>
      </div>
      <div className="sentinel-glass-panel p-3.5">
        <div className="mb-3 flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums tracking-[-0.03em] text-foreground">
            {score}
          </span>
          <span className="sentinel-rail-meta text-[11px]">/ 100</span>
        </div>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/35 transition-all"
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {dims.map((d) => (
            <div key={d.label} className="flex items-center justify-between gap-2">
              <span className="sentinel-rail-meta text-[10px]">{d.label}</span>
              <span className="text-[11px] font-medium tabular-nums tracking-tight text-foreground/85">
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectSummaryPanel({
  project,
  cards,
  events,
  focusSession,
}: {
  project: Project;
  cards: SentinelCard[];
  events: DockEvent[];
  focusSession: FocusSession;
}) {
  const active = countActiveProjectCards(project.id, cards);
  const backlog = countBacklogProjectCards(project.id, cards);

  const recentEvents = useMemo(() => {
    const related = events.filter((e) => eventRelatesToProject(e.message, project, cards));
    return [...related]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);
  }, [events, project, cards]);

  const suggestion = useMemo(
    () => projectSuggestedNextStep(project, cards, focusSession),
    [project, cards, focusSession],
  );

  const brief =
    project.description?.trim() ||
    "Sin descripción en el workspace: el detalle vive en tarjetas y comandos del dock.";

  const statusLabel =
    project.status === "active" ? "Activo" : project.status === "paused" ? "Pausado" : "Archivado";

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
      <div>
        <div className="flex items-start gap-2.5">
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border/30"
            style={{ backgroundColor: project.color }}
          />
          <div className="min-w-0 flex-1">
            <h2 className="sentinel-product-title">{project.name}</h2>
            <p className="sentinel-rail-meta mt-1.5 font-medium uppercase tracking-[0.06em]">
              {statusLabel}
            </p>
          </div>
        </div>
        <p className="sentinel-rail-body mt-3">{brief}</p>
      </div>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/22 ring-1 ring-primary/12" />
          <h3 className="sentinel-rail-section-label">Foco actual</h3>
        </div>
        <div className="sentinel-glass-panel px-3.5 py-3">
          <p className="sentinel-rail-body">{focusSummaryForProject(project, focusSession)}</p>
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/22 ring-1 ring-primary/12" />
          <h3 className="sentinel-rail-section-label">Carga del proyecto</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="sentinel-glass-panel px-3.5 py-2.5">
            <p className="sentinel-rail-meta text-[10px] font-medium uppercase tracking-[0.06em]">
              Activas
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
              {active}
            </p>
          </div>
          <div className="sentinel-glass-panel px-3.5 py-2.5">
            <p className="sentinel-rail-meta text-[10px] font-medium uppercase tracking-[0.06em]">
              Backlog
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
              {backlog}
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/22 ring-1 ring-primary/12" />
          <h3 className="sentinel-rail-section-label">Timeline reciente</h3>
        </div>
        <div className="flex flex-col gap-1">
          {recentEvents.map((ev) => {
            const Icon = eventIcons[ev.type];
            return (
              <div key={ev.id} className="flex items-start gap-2 rounded-md px-2 py-1.5">
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", eventColors[ev.type])} />
                <span className="sentinel-rail-body min-w-0 flex-1 text-[11px]">{ev.message}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatEventTime(ev.timestamp)}
                </span>
              </div>
            );
          })}
          {recentEvents.length === 0 && (
            <p className="sentinel-glass-panel px-3 py-3 text-center text-[11px] text-muted-foreground">
              Sin eventos vinculados a este proyecto en el registro actual.
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/22 ring-1 ring-primary/12" />
          <h3 className="sentinel-rail-section-label">Siguiente paso sugerido</h3>
        </div>
        <div className="sentinel-glass-panel p-3.5">
          <p className="sentinel-rail-body">{suggestion.explanation}</p>
          <div className="sentinel-command-snippet-wrap">
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Comando sugerido
              <span className="ml-1.5 font-mono text-[9px] font-normal normal-case tracking-normal text-muted-foreground/65">
                (Command Dock)
              </span>
            </p>
            <DockCommandSnippetBlock command={suggestion.command} />
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
        <section>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/25 ring-1 ring-primary/12" />
            <h3 className="sentinel-rail-section-label">Codex Loop</h3>
          </div>
          <div className="sentinel-glass-panel p-3.5">
            <ol className="flex flex-col gap-2">
              {["Problema", "Hipótesis", "Solución", "Validación"].map((s, i) => (
                <li key={s} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="text-[13px] tracking-[-0.01em] text-foreground/75">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/25 ring-1 ring-primary/12" />
            <h3 className="sentinel-rail-section-label">Código del Dinero</h3>
          </div>
          <div className="sentinel-glass-panel p-3.5">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums text-foreground/40">--</span>
              <span className="text-xs text-foreground/30">/ 100</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-0 rounded-full bg-primary/25" />
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-center text-[13px] font-semibold tracking-[-0.01em] text-foreground">
          Seleccioná una tarjeta
        </p>
        <p className="sentinel-rail-meta mt-1.5 text-center text-[11px]">
          Verás Codex Loop, Código del dinero y el siguiente comando sugerido.
        </p>
        <div className="sentinel-glass-panel--subtle mt-4 space-y-2 px-3.5 py-2.5 text-[11px] text-muted-foreground">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            Flujo rápido
          </p>
          <ul className="list-inside list-disc space-y-1 leading-snug">
            <li>
              Dock <span className="text-foreground/75">Comando</span>: crear / mover / foco / tiempo
            </li>
            <li>
              Dock <span className="text-foreground/75">Analizar</span>: pegar texto → acciones en el resultado
            </li>
            <li>
              Vista <span className="text-foreground/75">Backlog / Timeline</span>: abrir tarjetas desde el registro
            </li>
            <li>
              Sidebar <span className="text-foreground/75">Proyectos</span>: filtrar board y ver resumen aquí
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

export function RightPanel() {
  const { cards, projects, selectedCardId, selectedProjectId, events, focusSession } =
    useSentinel();
  const card = selectedCardId ? cards.find((c) => c.id === selectedCardId) : null;
  const project = card ? projects.find((p) => p.id === card.projectId) : null;
  const selectedProjectOnly =
    !card && selectedProjectId
      ? (projects.find((p) => p.id === selectedProjectId) ?? null)
      : null;
  const statusLabel = card ? STATUS_LABELS[card.status] ?? card.status : "";

  return (
    <aside className="sentinel-right-rail-edge flex w-72 shrink-0 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-12 shrink-0 flex-col justify-center gap-1 border-b border-sidebar-border px-5 py-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">Detalle</span>
          <span className="sentinel-rail-meta text-[10px] font-semibold uppercase tracking-[0.07em]">
            HEO
          </span>
        </div>
        <span className="sentinel-rail-meta text-[10px] leading-snug">
          {card
            ? "Comandos y análisis viven en el dock inferior"
            : selectedProjectOnly
              ? "Resumen del proyecto filtrado en el board"
              : "Comandos y análisis viven en el dock inferior"}
        </span>
      </div>

      {card ? (
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div>
            <h2 className="sentinel-product-title pr-1">{card.title}</h2>
            <p className="sentinel-rail-meta mt-2 text-[11px]">
              Tip: usá{" "}
              <kbd className="rounded-md border border-border/35 bg-muted/80 px-1 py-px font-mono text-[10px] text-foreground/80">
                Enter
              </kbd>{" "}
              en el dock para ejecutar el comando reconocido.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              <span className="rounded-md border border-border/25 bg-muted/60 px-1.5 py-0.5 font-medium uppercase tracking-wide text-foreground/75">
                {statusLabel}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="uppercase tracking-wide">{card.priority}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="capitalize tracking-wide">{card.type}</span>
            </div>
            {project && (
              <p className="sentinel-rail-meta mt-2.5 text-[11px]">
                Proyecto:{" "}
                <span className="font-medium text-foreground/85">{project.name}</span>
              </p>
            )}
            {card.blocked && (
              <p className="mt-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                Bloqueada
                {card.blockerReason ? ` — ${card.blockerReason}` : ""}
              </p>
            )}
          </div>

          {card.description && (
            <div>
              <p className="sentinel-rail-section-label mb-2">Descripción</p>
              <p className="sentinel-rail-body">{card.description}</p>
            </div>
          )}

          {card.tags.length > 0 && (
            <div>
              <p className="sentinel-rail-section-label mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-border/25 bg-muted/50 px-1.5 py-0.5 text-[10px] tracking-wide text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {card.checklist.length > 0 && (
            <div>
              <p className="sentinel-rail-section-label mb-2">Checklist</p>
              <p className="text-[13px] tabular-nums tracking-tight text-foreground/88">
                {card.checklist.filter((i) => i.status === "done").length} / {card.checklist.length}{" "}
                hecho
              </p>
            </div>
          )}

          <SuggestedNextActionSection card={card} projectName={project?.name} />

          <CodexLoopSection card={card} />
          <MoneyCodeSection card={card} />
        </div>
      ) : selectedProjectOnly ? (
        <ProjectSummaryPanel
          project={selectedProjectOnly}
          cards={cards}
          events={events}
          focusSession={focusSession}
        />
      ) : (
        <EmptyState />
      )}
    </aside>
  );
}
