"use client";

import { useRef, useEffect, useCallback } from "react";
import { Terminal, Cpu, Clock, Sparkles } from "lucide-react";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";
import type { EventType } from "@/types/event";
import type { SentinelCard } from "@/types/card";
import { cn } from "@/lib/utils";

const iconMap: Record<EventType, typeof Terminal> = {
  command: Terminal,
  system: Cpu,
  focus: Clock,
  heo_suggestion: Sparkles,
};

const colorMap: Record<EventType, string> = {
  command: "text-emerald-400",
  system: "text-muted-foreground",
  focus: "text-amber-400",
  heo_suggestion: "text-violet-400",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function resolveCardFromLogMessage(message: string, cards: SentinelCard[]): SentinelCard | null {
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

export function CommandLog() {
  const { events, cards } = useSentinel();
  const dispatch = useSentinelDispatch();
  const bottomRef = useRef<HTMLDivElement>(null);

  const openCard = useCallback(
    (cardId: string) => {
      dispatch({ type: "SELECT_CARD", cardId });
      dispatch({ type: "SET_VIEW", view: "board" });
    },
    [dispatch],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground/50">Sin eventos recientes</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto pr-1">
      {events.map((event) => {
        const Icon = iconMap[event.type];
        const linked = resolveCardFromLogMessage(event.message, cards);
        return (
          <div
            key={event.id}
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
              "group flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/30",
              linked && "cursor-pointer hover:bg-muted/45",
            )}
            title={linked ? `Abrir «${linked.title}» en el board` : undefined}
          >
            <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${colorMap[event.type]}`} />
            <span className="flex-1 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80">
              {event.message}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
              {formatTime(event.timestamp)}
            </span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
