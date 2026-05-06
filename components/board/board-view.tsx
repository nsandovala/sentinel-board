"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Brain, Clock, Cpu, Sparkles, Terminal } from "lucide-react";
import { CardItemOverlay } from "./card-item";
import { Column } from "./column";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";
import {
  filterCardsByProjectId,
  filterEventsByProjectId,
} from "@/lib/state/sentinel-reducer";
import { scoreAndSortBacklog } from "@/lib/scoring/backlog-scorer";
import { cn } from "@/lib/utils";
import type { SentinelCard } from "@/types/card";
import { CardStatus } from "@/types/enums";
import type { DockEvent, EventType } from "@/types/event";

const statusColumns: { key: CardStatus; label: string }[] = [
  { key: "idea_bruta", label: "Idea Bruta" },
  { key: "clarificando", label: "Clarificando" },
  { key: "validando", label: "Validando" },
  { key: "en_proceso", label: "En Proceso" },
  { key: "desarrollo", label: "Desarrollo" },
  { key: "qa", label: "QA" },
  { key: "listo", label: "Listo" },
  { key: "produccion", label: "Produccion" },
  { key: "archivado", label: "Archivado" },
];

function groupByStatus(items: SentinelCard[]): Record<CardStatus, SentinelCard[]> {
  const grouped = {} as Record<CardStatus, SentinelCard[]>;
  for (const { key } of statusColumns) grouped[key] = [];
  for (const item of items) grouped[item.status]?.push(item);
  return grouped;
}

const eventIcons: Record<EventType, typeof Terminal> = {
  command: Terminal,
  system: Cpu,
  focus: Clock,
  heo_suggestion: Sparkles,
};

const eventColors: Record<EventType, string> = {
  command: "text-emerald-400/82",
  system: "text-muted-foreground",
  focus: "text-amber-400/78",
  heo_suggestion: "text-violet-400/78",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function resolveCardFromTimelineMessage(
  message: string,
  cards: SentinelCard[],
): SentinelCard | null {
  const tryTitle = (raw: string): SentinelCard | null => {
    const title = raw.trim();
    if (!title || title.length > 200) return null;
    const lower = title.toLowerCase();

    return (
      cards.find((card) => card.title === title) ??
      cards.find((card) => card.title.toLowerCase() === lower) ??
      cards.find((card) => card.title.toLowerCase().includes(lower)) ??
      cards.find((card) => lower.includes(card.title.toLowerCase()) && card.title.length > 2) ??
      null
    );
  };

  for (const match of message.matchAll(/"([^"]{1,200})"/g)) {
    const hit = tryTitle(match[1] ?? "");
    if (hit) return hit;
  }

  const created = message.match(/Tarea creada:\s*"([^"]+)"/i);
  if (created?.[1]) {
    const hit = tryTitle(created[1]);
    if (hit) return hit;
  }

  const arrow = message.match(/^"([^"]+)"\s*(?:->|→)/);
  if (arrow?.[1]) {
    const hit = tryTitle(arrow[1]);
    if (hit) return hit;
  }

  return null;
}

function TimelineView({ events, cards }: { events: DockEvent[]; cards: SentinelCard[] }) {
  const dispatch = useSentinelDispatch();
  const sorted = [...events].reverse();

  const openCard = (card: SentinelCard) => {
    dispatch({ type: "SELECT_PROJECT", projectId: card.projectId });
    dispatch({ type: "SET_VIEW", view: "board" });
    dispatch({ type: "SELECT_CARD", cardId: card.id });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <h2 className="mb-4 text-sm font-semibold text-foreground">Timeline</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Clic en una fila con tarjeta citada abre el detalle en el board.
      </p>
      <div className="flex flex-col gap-1">
        {sorted.map((event) => {
          const Icon = eventIcons[event.type];
          const linkedCard = resolveCardFromTimelineMessage(event.message, cards);

          return (
            <div
              key={event.id}
              role={linkedCard ? "button" : undefined}
              tabIndex={linkedCard ? 0 : undefined}
              onClick={linkedCard ? () => openCard(linkedCard) : undefined}
              onKeyDown={
                linkedCard
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openCard(linkedCard);
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/25",
                linkedCard && "cursor-pointer hover:bg-muted/38",
              )}
              title={linkedCard ? `Abrir "${linkedCard.title}"` : undefined}
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${eventColors[event.type]}`} />
              <span className="flex-1 whitespace-pre-wrap text-[13px] text-foreground/80">
                {event.message}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatTime(event.timestamp)}
              </span>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Sin eventos</p>
        )}
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-red-400 bg-red-400/10 ring-red-400/20";
  if (score >= 40) return "text-amber-400 bg-amber-400/10 ring-amber-400/20";
  return "text-muted-foreground bg-muted/50 ring-border/30";
}

interface BacklogAnalysisResult {
  suggestions: { cardId: string; title: string; justification: string }[];
  reasoning?: string;
}

function BacklogView({
  cards,
  activeProject,
  allProjects,
}: {
  cards: SentinelCard[];
  activeProject: { id: string; name: string } | null;
  allProjects: { id: string; name: string }[];
}) {
  const { selectedCardId } = useSentinel();
  const dispatch = useSentinelDispatch();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<BacklogAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const scored = scoreAndSortBacklog(cards);

  const handleAnalyze = async () => {
    if (scored.length === 0) return;

    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const inputCards = scored.map(({ card, score }) => ({
        id: card.id,
        title: card.title,
        description: card.description,
        status: card.status,
        projectId: card.projectId,
        tags: card.tags,
        blocked: card.blocked,
        priority: card.priority,
        createdAt: card.createdAt,
        score: score.score,
        ageScore: score.ageScore,
        projectScore: score.projectScore,
        urgencyScore: score.urgencyScore,
      }));

      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "backlog-analyzer",
          input: {
            cards: inputCards,
            activeProject,
            allProjects,
          },
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setAnalysisError(data.error ?? "Error al analizar el backlog");
        return;
      }

      const parsed = data.parsed as BacklogAnalysisResult | undefined;
      if (parsed?.suggestions) {
        setAnalysisResult(parsed);
      } else {
        setAnalysisError("Respuesta invalida del agente");
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Error de conexion");
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePromote = (cardId: string) => {
    dispatch({ type: "MOVE_CARD", cardId, status: "clarificando" });
    setAnalysisResult((prev) =>
      prev
        ? {
            ...prev,
            suggestions: prev.suggestions.filter((suggestion) => suggestion.cardId !== cardId),
          }
        : null,
    );
  };

  const openInBoard = (card: SentinelCard) => {
    dispatch({ type: "SELECT_PROJECT", projectId: card.projectId });
    dispatch({ type: "SET_VIEW", view: "board" });
    dispatch({ type: "SELECT_CARD", cardId: card.id });
  };

  const blockedSuggestedAction = (card: SentinelCard) =>
    card.status === "idea_bruta"
      ? 'Promover a "clarificando" para bajar alcance y destrabar definiciones.'
      : 'Diagnosticar el bloqueo y mover a "clarificando" si falta definicion operativa.';

  return (
    <div className="sentinel-board-canvas flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Backlog</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ideas brutas y tareas bloqueadas · ordenadas por prioridad · clic en fila para ver
            detalle
          </p>
        </div>
        <button
          type="button"
          disabled={analyzing || scored.length === 0}
          onClick={handleAnalyze}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/80 disabled:opacity-50"
          title="Analizar backlog con IA"
        >
          <Brain className="h-3.5 w-3.5" />
          {analyzing ? "Analizando..." : "Analizar Backlog"}
        </button>
      </div>

      {analysisError && (
        <div className="mb-4 rounded-lg border border-red-400/20 bg-red-500/5 p-3 text-xs text-red-400">
          {analysisError}
        </div>
      )}

      {analysisResult && analysisResult.suggestions.length > 0 && (
        <div className="mb-4 rounded-lg border border-violet-400/20 bg-violet-500/5 p-4">
          <h3 className="mb-2 text-xs font-semibold text-violet-400">
            Sugerencias de promocion
          </h3>
          {analysisResult.suggestions.map((suggestion) => (
            <div
              key={suggestion.cardId}
              className="mb-2 flex items-center justify-between rounded-md border border-border/30 bg-card px-3 py-2"
            >
              <div className="flex-1">
                <span className="text-[13px] font-medium text-card-foreground">
                  {suggestion.title}
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {suggestion.justification}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePromote(suggestion.cardId)}
                className="ml-3 shrink-0 rounded-md bg-violet-500 px-2 py-1 text-xs font-medium text-white hover:bg-violet-600"
              >
                Promover
              </button>
            </div>
          ))}
          {analysisResult.reasoning && (
            <p className="mt-3 border-t border-violet-400/10 pt-2 text-xs italic text-muted-foreground">
              {analysisResult.reasoning}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {scored.map(({ card, score }) => (
          <div
            key={card.id}
            role="button"
            tabIndex={0}
            onClick={() => dispatch({ type: "SELECT_CARD", cardId: card.id })}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                dispatch({ type: "SELECT_CARD", cardId: card.id });
              }
            }}
            className={cn(
              "sentinel-backlog-row group flex w-full flex-col gap-2 rounded-lg p-3 text-left transition-colors hover:border-border/40 hover:bg-muted/20",
              selectedCardId === card.id && "sentinel-backlog-row-selected",
            )}
          >
            <div className="flex w-full items-center gap-3">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  card.blocked ? "bg-red-400/85" : "bg-foreground/28",
                )}
                title={card.blocked ? "Bloqueada" : "Disponible"}
              />
              <div className="min-w-0 flex-1">
                <span className="text-[13px] font-medium text-card-foreground">{card.title}</span>
                {card.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {card.description}
                  </p>
                )}
              </div>
              <span className="text-[10px] uppercase text-muted-foreground">{card.status}</span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1",
                  scoreColor(score.score),
                )}
                title={`Score: ${score.score} (edad: ${score.ageScore}, proyecto: ${score.projectScore}, urgencia: ${score.urgencyScore})`}
              >
                {score.score}
              </span>
            </div>

            {card.blocked && (
              <div className="flex items-center gap-2 rounded-md border border-red-400/20 bg-red-500/5 px-2.5 py-1.5">
                <span className="min-w-0 flex-1 text-[11px] text-red-300">
                  Bloqueada
                  {card.blockerReason ? ` · ${card.blockerReason}` : " · sin motivo registrado"}
                  <span className="ml-2 text-[10px] text-red-200/75">
                    Accion sugerida: {blockedSuggestedAction(card)}
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePromote(card.id);
                  }}
                  className="text-[11px] font-medium text-violet-300 hover:text-violet-200"
                >
                  Promover a clarificando
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 pl-5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePromote(card.id);
                }}
                className="rounded-md border border-border/30 bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground/80 transition-colors hover:bg-primary/15 hover:text-foreground"
              >
                Promover
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openInBoard(card);
                }}
                className="rounded-md border border-border/30 bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground/80 transition-colors hover:bg-primary/15 hover:text-foreground"
              >
                Abrir en board
              </button>
            </div>
          </div>
        ))}
        {scored.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Backlog vacio</p>
        )}
      </div>
    </div>
  );
}

export function BoardView() {
  const { cards, events, activeView, selectedProjectId, projects } = useSentinel();
  const dispatch = useSentinelDispatch();
  const [activeCard, setActiveCard] = useState<SentinelCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const card = (event.active.data.current as { card?: SentinelCard })?.card ?? null;
    setActiveCard(card);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveCard(null);
      const { active, over } = event;
      if (!over) return;

      const card = (active.data.current as { card?: SentinelCard })?.card;
      const targetStatus = (over.data.current as { status?: CardStatus })?.status;

      if (!card || !targetStatus || card.status === targetStatus) return;
      dispatch({ type: "MOVE_CARD", cardId: card.id, status: targetStatus });
    },
    [dispatch],
  );

  const visibleCards = filterCardsByProjectId(cards, selectedProjectId);
  const visibleEvents = filterEventsByProjectId(events, selectedProjectId, projects, cards);

  if (activeView === "timeline") {
    return <TimelineView events={visibleEvents} cards={visibleCards} />;
  }

  if (activeView === "backlog") {
    const activeProject = selectedProjectId
      ? projects.find((project) => project.id === selectedProjectId) ?? null
      : null;
    const projectsForAnalyzer = projects.map((project) => ({
      id: project.id,
      name: project.name,
    }));

    return (
      <BacklogView
        cards={visibleCards}
        activeProject={activeProject ? { id: activeProject.id, name: activeProject.name } : null}
        allProjects={projectsForAnalyzer}
      />
    );
  }

  const grouped = groupByStatus(visibleCards);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="sentinel-board-canvas sentinel-board-pizarra relative isolate flex h-full gap-3 overflow-x-auto p-3">
        {statusColumns.map(({ key, label }) => (
          <div key={key} className="sentinel-board-lane shrink-0">
            <Column title={label} status={key} cards={grouped[key]} />
          </div>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeCard ? <CardItemOverlay card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
