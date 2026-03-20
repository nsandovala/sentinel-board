"use client";

import { useSentinel } from "@/lib/state/sentinel-store";
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
  command: "text-emerald-400",
  system: "text-muted-foreground",
  focus: "text-amber-400",
  heo_suggestion: "text-violet-400",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function TimelineView({ events }: { events: DockEvent[] }) {
  const sorted = [...events].reverse();
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <h2 className="mb-4 text-sm font-semibold text-foreground">Timeline</h2>
      <div className="flex flex-col gap-1">
        {sorted.map((ev) => {
          const Icon = eventIcons[ev.type];
          return (
            <div key={ev.id} className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted/30">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${eventColors[ev.type]}`} />
              <span className="flex-1 text-[13px] text-foreground/80">{ev.message}</span>
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
  const backlog = cards.filter((c) => c.status === "idea_bruta" || c.blocked);
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Backlog</h2>
      <p className="mb-4 text-xs text-muted-foreground">Ideas brutas y tareas bloqueadas</p>
      <div className="flex flex-col gap-2">
        {backlog.map((card) => (
          <div key={card.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            {card.blocked && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" title="Bloqueada" />
            )}
            {!card.blocked && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-zinc-400" />
            )}
            <div className="flex-1">
              <span className="text-[13px] font-medium text-card-foreground">{card.title}</span>
              {card.description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{card.description}</p>
              )}
            </div>
            <span className="text-[10px] uppercase text-muted-foreground">{card.status}</span>
          </div>
        ))}
        {backlog.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Backlog vacío</p>
        )}
      </div>
    </div>
  );
}

export function BoardView() {
  const { cards, events, activeView } = useSentinel();

  if (activeView === "timeline") return <TimelineView events={events} />;
  if (activeView === "backlog") return <BacklogView cards={cards} />;

  const grouped = groupByStatus(cards);
  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4">
      {statusColumns.map(({ key, label }) => (
        <Column key={key} title={label} cards={grouped[key]} />
      ))}
    </div>
  );
}
