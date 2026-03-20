"use client";

import { useRef, useEffect } from "react";
import { Terminal, Cpu, Clock, Sparkles } from "lucide-react";
import { useSentinel } from "@/lib/state/sentinel-store";
import type { EventType } from "@/types/event";

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

export function CommandLog() {
  const { events } = useSentinel();
  const bottomRef = useRef<HTMLDivElement>(null);

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
        return (
          <div
            key={event.id}
            className="group flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/30"
          >
            <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${colorMap[event.type]}`} />
            <span className="flex-1 text-[12px] leading-relaxed text-foreground/80">
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
