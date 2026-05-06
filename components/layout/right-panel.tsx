"use client";

import { useMemo, useRef, useState } from "react";
import { Clock, Cpu, MessageSquare, Send, Sparkles, Terminal, Trash2 } from "lucide-react";
import { useSentinel, useSentinelDispatch, useSentinelRefresh } from "@/lib/state/sentinel-store";
import { eventRelatesToProject } from "@/lib/state/sentinel-reducer";
import { STATUS_LABELS } from "@/lib/console/status-labels";
import { cn } from "@/lib/utils";
import type { CommentType } from "@/types/comment";
import type { SentinelCard } from "@/types/card";
import type { Project } from "@/types/project";
import type { DockEvent, EventType } from "@/types/event";
import type { FocusSession } from "@/types/timer";
import type { CardStatus } from "@/types/enums";
import { CommandSnippetBlock } from "@/components/detail/command-snippet-block";
import { SuggestedActionPanel } from "@/components/detail/suggested-action-panel";
import { CodexLoopPanel } from "@/components/detail/codex-loop-panel";
import { MoneyCodePanel } from "@/components/detail/money-code-panel";
import { AgentMetadataPanel } from "@/components/detail/agent-metadata-panel";

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

const commentTypeBadge: Record<CommentType, { label: string; classes: string }> = {
  comment: { label: "Comentario", classes: "bg-muted/70 text-muted-foreground" },
  decision: { label: "Decision", classes: "bg-amber-950/50 text-amber-300/90" },
  system: { label: "Sistema", classes: "bg-blue-950/40 text-blue-300/80" },
  agent: { label: "Agente", classes: "bg-violet-950/40 text-violet-300/80" },
};

function formatEventTime(date: Date): string {
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function countActiveProjectCards(projectId: string, cards: SentinelCard[]): number {
  return cards.filter((card) => card.projectId === projectId && !doneLike.includes(card.status)).length;
}

function countBacklogProjectCards(projectId: string, cards: SentinelCard[]): number {
  return cards.filter(
    (card) => card.projectId === projectId && (card.status === "idea_bruta" || card.blocked),
  ).length;
}

function focusSummaryForProject(project: Project, session: FocusSession): string {
  if (session.state === "running" && session.project) {
    const sameProject = session.project.trim().toLowerCase() === project.name.trim().toLowerCase();
    if (sameProject) {
      const minutes = Math.floor(session.elapsed / 60);
      const seconds = session.elapsed % 60;
      return `Foco activo · ${minutes}m ${seconds}s en ${project.name}`;
    }
    return `Hay otro foco corriendo en ${session.project}.`;
  }

  return "Sin foco activo para este proyecto.";
}

function projectSuggestedNextStep(
  project: Project,
  cards: SentinelCard[],
  session: FocusSession,
): { explanation: string; command: string } {
  const projectCards = cards.filter((card) => card.projectId === project.id);
  const blocked = projectCards.find((card) => card.blocked);
  if (blocked) {
    return {
      explanation: `Desbloquea "${blocked.title}" antes de seguir cargando el flujo.`,
      command: `focus "${blocked.title}"`,
    };
  }

  const idea = projectCards.find((card) => card.status === "idea_bruta" && card.metadata?.plan?.length);
  if (idea) {
    return {
      explanation: `Hay una idea con plan suficiente para empezar a operarla de verdad.`,
      command: `move "${idea.title}" to clarificando`,
    };
  }

  const sameFocus =
    session.state === "running" &&
    session.project?.trim().toLowerCase() === project.name.trim().toLowerCase();

  if (!sameFocus) {
    return {
      explanation: "Abre un bloque corto de foco para convertir backlog en ejecucion visible.",
      command: "analyze backlog",
    };
  }

  const activeCard = projectCards.find((card) =>
    ["clarificando", "validando", "en_proceso", "desarrollo", "qa"].includes(card.status),
  );

  if (activeCard) {
    return {
      explanation: `El cuello actual esta en "${activeCard.title}". Abrela y empuja el siguiente paso.`,
      command: `focus "${activeCard.title}"`,
    };
  }

  return {
    explanation: "El proyecto ya no tiene un cuello claro. Conviene revisar backlog y reordenar prioridad.",
    command: "status",
  };
}

function CardCommentsSection({ cardId }: { cardId: string }) {
  const { cardComments, cardCommentsFor } = useSentinel();
  const dispatch = useSentinelDispatch();
  const [body, setBody] = useState("");
  const [commentType, setCommentType] = useState<CommentType>("comment");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const comments = cardCommentsFor === cardId ? cardComments : [];

  const handleSubmit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    dispatch({
      type: "ADD_COMMENT",
      comment: {
        id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        cardId,
        author: "user",
        body: trimmed,
        type: commentType,
        createdAt: new Date().toISOString(),
      },
    });

    setBody("");
    setCommentType("comment");
    inputRef.current?.focus();
  };

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-primary/40" />
        <h3 className="sentinel-rail-section-label">Actividad</h3>
        {comments.length > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">{comments.length}</span>
        )}
      </div>

      <div className="sentinel-glass-panel p-3">
        <div className="mb-3 flex gap-1.5">
          <textarea
            ref={inputRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Agregar comentario..."
            rows={2}
            className="flex-1 resize-none rounded-md border border-border/30 bg-background/50 px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!body.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-md border border-border/30 bg-muted/50 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground disabled:opacity-30"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mb-3 flex gap-1">
          {(Object.keys(commentTypeBadge) as CommentType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCommentType(type)}
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide transition-colors",
                commentType === type
                  ? "border-primary/30 bg-primary/10 text-foreground/80"
                  : "border-border/20 bg-transparent text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {commentTypeBadge[type].label}
            </button>
          ))}
        </div>

        {comments.length === 0 ? (
          <p className="py-2 text-center text-[10px] text-muted-foreground/60">
            Sin actividad registrada
          </p>
        ) : (
          <div className="flex max-h-52 flex-col gap-2 overflow-y-auto">
            {comments.map((comment) => {
              const badge = commentTypeBadge[comment.type] ?? commentTypeBadge.comment;
              const time = new Date(comment.createdAt);

              return (
                <div
                  key={comment.id}
                  className="rounded-md border border-border/15 bg-background/30 px-2.5 py-2"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] font-medium text-foreground/75">
                      {comment.author}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1 py-px text-[8px] font-semibold uppercase tracking-wider",
                        badge.classes,
                      )}
                    >
                      {badge.label}
                    </span>
                    <span className="ml-auto text-[9px] tabular-nums text-muted-foreground/50">
                      {time.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}{" "}
                      {time.toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">
                    {comment.body}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function DeleteCardButton({ cardId }: { cardId: string }) {
  const dispatch = useSentinelDispatch();
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    if (confirming) {
      dispatch({ type: "DELETE_CARD", cardId });
      return;
    }

    setConfirming(true);
    setTimeout(() => setConfirming(false), 3000);
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors",
        confirming
          ? "border-red-700/50 bg-red-950/60 text-red-300 hover:bg-red-900/60"
          : "border-border/30 bg-muted/50 text-muted-foreground hover:border-red-800/40 hover:bg-red-950/40 hover:text-red-300",
      )}
    >
      <Trash2 className="h-3 w-3" />
      {confirming ? "Confirmar" : "Eliminar"}
    </button>
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
    const related = events.filter((event) => eventRelatesToProject(event.message, project, cards));
    return [...related].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
  }, [events, project, cards]);

  const suggestion = useMemo(
    () => projectSuggestedNextStep(project, cards, focusSession),
    [project, cards, focusSession],
  );

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
      <div>
        <h2 className="sentinel-product-title">{project.name}</h2>
        <p className="sentinel-rail-meta mt-1.5 uppercase tracking-[0.06em]">
          {project.status}
        </p>
        <p className="sentinel-rail-body mt-3">
          {project.description?.trim() ||
            "Sin descripcion persistida. El contexto operativo vive en tarjetas, timeline y comandos."}
        </p>
      </div>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/22 ring-1 ring-primary/12" />
          <h3 className="sentinel-rail-section-label">Foco actual</h3>
        </div>
        <div className="sentinel-glass-panel px-3.5 py-3">
          <p className="sentinel-rail-body">{focusSummaryForProject(project, focusSession)}</p>
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/22 ring-1 ring-primary/12" />
          <h3 className="sentinel-rail-section-label">Carga operativa</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="sentinel-glass-panel px-3.5 py-2.5">
            <p className="sentinel-rail-meta text-[10px] uppercase tracking-[0.06em]">Activas</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{active}</p>
          </div>
          <div className="sentinel-glass-panel px-3.5 py-2.5">
            <p className="sentinel-rail-meta text-[10px] uppercase tracking-[0.06em]">Backlog</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{backlog}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/22 ring-1 ring-primary/12" />
          <h3 className="sentinel-rail-section-label">Siguiente paso sugerido</h3>
        </div>
        <div className="sentinel-glass-panel p-3.5">
          <p className="sentinel-rail-body">{suggestion.explanation}</p>
          <div className="sentinel-command-snippet-wrap">
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Comando sugerido
            </p>
            <CommandSnippetBlock command={suggestion.command} />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/22 ring-1 ring-primary/12" />
          <h3 className="sentinel-rail-section-label">Timeline reciente</h3>
        </div>
        <div className="flex flex-col gap-1">
          {recentEvents.map((event) => {
            const Icon = eventIcons[event.type];
            return (
              <div key={event.id} className="flex items-start gap-2 rounded-md px-2 py-1.5">
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", eventColors[event.type])} />
                <span className="sentinel-rail-body min-w-0 flex-1 text-[11px]">
                  {event.message}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatEventTime(event.timestamp)}
                </span>
              </div>
            );
          })}
          {recentEvents.length === 0 && (
            <p className="sentinel-glass-panel px-3 py-3 text-center text-[11px] text-muted-foreground">
              Sin eventos relacionados con este proyecto.
            </p>
          )}
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
            <span className="h-1.5 w-1.5 rounded-full bg-primary/25 ring-1 ring-primary/12" />
            <h3 className="sentinel-rail-section-label">Cockpit operativo</h3>
          </div>
          <div className="sentinel-glass-panel p-3.5">
            <p className="sentinel-rail-body">
              Selecciona una tarjeta para ver analisis real, metadata de agente, siguiente accion y actividad.
            </p>
          </div>
        </section>

        <section>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/25 ring-1 ring-primary/12" />
            <h3 className="sentinel-rail-section-label">Comandos utiles</h3>
          </div>
          <div className="sentinel-glass-panel p-3.5">
            <div className="space-y-2">
              <CommandSnippetBlock command='move "Card title" to clarificando' />
              <CommandSnippetBlock command='focus "Card title"' />
              <CommandSnippetBlock command='score "Card title"' />
              <CommandSnippetBlock command="analyze backlog" />
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-center text-[13px] font-semibold tracking-[-0.01em] text-foreground">
          Selecciona una tarjeta
        </p>
        <p className="sentinel-rail-meta mt-1.5 text-center text-[11px]">
          El panel lateral ahora usa metadata real, score operativo y acciones ejecutables.
        </p>
      </div>
    </>
  );
}

export function RightPanel() {
  const { cards, projects, selectedCardId, selectedProjectId, events, focusSession } = useSentinel();
  const dispatch = useSentinelDispatch();
  const refresh = useSentinelRefresh();

  const card = selectedCardId ? cards.find((item) => item.id === selectedCardId) ?? null : null;
  const project = card ? projects.find((item) => item.id === card.projectId) ?? null : null;
  const selectedProjectOnly =
    !card && selectedProjectId ? projects.find((item) => item.id === selectedProjectId) ?? null : null;

  const statusLabel = card ? STATUS_LABELS[card.status] ?? card.status : "";

  const openCard = (cardId: string, projectId?: string) => {
    if (projectId) {
      dispatch({ type: "SELECT_PROJECT", projectId });
    }
    dispatch({ type: "SET_VIEW", view: "board" });
    dispatch({ type: "SELECT_CARD", cardId });
  };

  return (
    <aside className="sentinel-right-rail-edge flex w-80 shrink-0 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-12 shrink-0 flex-col justify-center gap-1 border-b border-sidebar-border px-5 py-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">
            Detalle
          </span>
          <span className="sentinel-rail-meta text-[10px] font-semibold uppercase tracking-[0.07em]">
            Cockpit
          </span>
        </div>
        <span className="sentinel-rail-meta text-[10px] leading-snug">
          {card
            ? "Analisis, metadata y accion sugerida derivados de la card seleccionada."
            : selectedProjectOnly
              ? "Resumen operativo del proyecto filtrado."
              : "Selecciona una tarjeta para abrir el cockpit lateral."}
        </span>
      </div>

      {card ? (
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div>
            <h2 className="sentinel-product-title pr-1">{card.title}</h2>
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
                Proyecto: <span className="font-medium text-foreground/85">{project.name}</span>
              </p>
            )}
            {card.blocked && (
              <p className="mt-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                Bloqueada{card.blockerReason ? ` — ${card.blockerReason}` : ""}
              </p>
            )}
            <div className="mt-2.5 flex gap-2">
              <DeleteCardButton cardId={card.id} />
            </div>
          </div>

          {card.description && (
            <div>
              <p className="sentinel-rail-section-label mb-2">Descripcion</p>
              <p className="sentinel-rail-body whitespace-pre-wrap">{card.description}</p>
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
                {card.checklist.filter((item) => item.status === "done").length} / {card.checklist.length} hecho
              </p>
            </div>
          )}

          <SuggestedActionPanel card={card} onRefresh={refresh} onOpenCard={openCard} />
          <CodexLoopPanel card={card} />
          <MoneyCodePanel card={card} />
          <AgentMetadataPanel card={card} events={events} />
          <CardCommentsSection cardId={card.id} />
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
