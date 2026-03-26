"use client";

import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";
import { CardStatus } from "@/types/enums";
import { SentinelCard } from "@/types/card";
import { Column } from "./column";
import {
  Terminal,
  Cpu,
  Clock,
  Sparkles,
} from "lucide-react";
import type { DockEvent, EventType } from "@/types/event";
import { cn } from "@/lib/utils";
import {
  filterCardsByProjectId,
  filterEventsByProjectId,
} from "@/lib/state/sentinel-reducer";

const statusColumns: { key: CardStatus; label: string }[] = [
  { key: "idea_bruta", label: "Idea Bruta" },
  { key: "clarificando", label: "Clarificando" },
  { key: "validando", label: "Validando" },
  { key: "en_proceso", label: "En Proceso" },
  { key: "desarrollo", label: "Desarrollo" },
  { key: "qa", label: "QA" },
  { key: "listo", label: "Listo" },
  { key: "produccion", label: "Producción" },
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

function resolveCardFromTimelineMessage(message: string, cards: SentinelCard[]): SentinelCard | null {
  const tryTitle = (raw: string): SentinelCard | null => {
    const t = raw.trim();
    if (!t || t.length > 200) return null;
    const low = t.toLowerCase();
    return (
      cards.find((c) => c.title === t) ??
      cards.find((c) => c.title.toLowerCase() === low) ??
      cards.find((c) => c.title.toLowerCase().includes(low)) ??
      cards.find((c) => low.includes(c.title.toLowerCase()) && c.title.length > 2) ??
      null
    );
  };

  for (const m of message.matchAll(/"([^"]{1,200})"/g)) {
    const hit = tryTitle(m[1] ?? "");
    if (hit) return hit;
  }

  const created = message.match(/Tarea creada:\s*"([^"]+)"/i);
  if (created?.[1]) {
    const hit = tryTitle(created[1]);
    if (hit) return hit;
  }

  const arrow = message.match(/^"([^"]+)"\s*(?:→|->)/);
  if (arrow?.[1]) {
    const hit = tryTitle(arrow[1]);
    if (hit) return hit;
  }

  return null;
}

function TimelineView({ events, cards }: { events: DockEvent[]; cards: SentinelCard[] }) {
  const dispatch = useSentinelDispatch();
  const sorted = [...events].reverse();

  const openCard = (cardId: string) => {
    dispatch({ type: "SELECT_CARD", cardId });
    dispatch({ type: "SET_VIEW", view: "board" });
  };

  return (
    <div className="sentinel-board-canvas flex h-full flex-col overflow-y-auto p-6">
      <h2 className="mb-4 text-sm font-semibold text-foreground">Timeline</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Clic en una fila con tarjeta citada abre el detalle en el board.
      </p>
      <div className="flex flex-col gap-1">
        {sorted.map((ev) => {
          const Icon = eventIcons[ev.type];
          const linked = resolveCardFromTimelineMessage(ev.message, cards);
          return (
            <div
              key={ev.id}
              role={linked ? "button" : undefined}
              tabIndex={linked ? 0 : undefined}
              onClick={linked ? () => openCard(linked.id) : undefined}
              onKeyDown={
                linked
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openCard(linked.id);
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/25",
                linked && "cursor-pointer hover:bg-muted/38",
              )}
              title={linked ? `Abrir «${linked.title}»` : undefined}
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${eventColors[ev.type]}`} />
              <span className="flex-1 whitespace-pre-wrap text-[13px] text-foreground/80">{ev.message}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatTime(ev.timestamp)}
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

function BacklogView({ cards }: { cards: SentinelCard[] }) {
  const dispatch = useSentinelDispatch();
  const backlog = cards.filter((c) => c.status === "idea_bruta" || c.blocked);
  return (
    <div className="sentinel-board-canvas flex h-full flex-col overflow-y-auto p-6">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Backlog</h2>
      <p className="mb-4 text-xs text-muted-foreground">Ideas brutas y tareas bloqueadas · clic para abrir en board</p>
      <div className="flex flex-col gap-2">
        {backlog.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => {
              dispatch({ type: "SELECT_CARD", cardId: card.id });
              dispatch({ type: "SET_VIEW", view: "board" });
            }}
            className="sentinel-backlog-row flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors"
          >
            {card.blocked && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-400/85" title="Bloqueada" />
            )}
            {!card.blocked && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-foreground/28" />
            )}
            <div className="flex-1">
              <span className="text-[13px] font-medium text-card-foreground">{card.title}</span>
              {card.description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{card.description}</p>
              )}
            </div>
            <span className="text-[10px] uppercase text-muted-foreground">{card.status}</span>
          </button>
        ))}
        {backlog.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Backlog vacío</p>
        )}
      </div>
    </div>
  );
}

export function BoardView() {
  const { cards, events, activeView, selectedProjectId, projects } = useSentinel();

  const visibleCards = filterCardsByProjectId(cards, selectedProjectId);
  const visibleEvents = filterEventsByProjectId(events, selectedProjectId, projects, cards);

  if (activeView === "timeline")
    return <TimelineView events={visibleEvents} cards={visibleCards} />;
  if (activeView === "backlog") return <BacklogView cards={visibleCards} />;

  const grouped = groupByStatus(visibleCards);
  return (
    <div className="sentinel-board-canvas sentinel-board-pizarra relative isolate flex h-full gap-3 overflow-x-auto p-3">
      {statusColumns.map(({ key, label }) => (
        <div key={key} className="sentinel-board-lane shrink-0">
          <Column title={label} cards={grouped[key]} />
        </div>
      ))}
    </div>
  );
}
