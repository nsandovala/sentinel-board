"use client";

import { Play, Pause, Square, Clock, Crosshair } from "lucide-react";
import { focusCardById } from "@/lib/board/focus-card";
import { cn } from "@/lib/utils";
import type { FocusSession } from "@/types/timer";
import type { SentinelCard } from "@/types/card";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

interface FocusModeProps {
  session: FocusSession;
  activeCard: SentinelCard | null;
  projectName?: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

export function FocusMode({
  session,
  activeCard,
  projectName,
  onStart,
  onPause,
  onResume,
  onEnd,
}: FocusModeProps) {
  const running = session.state === "running";
  const paused = session.state === "paused";
  const idle = !running && !paused;
  const stateLabel = running ? "EN CURSO" : paused ? "EN PAUSA" : "DETENIDO";
  const stateClass = running
    ? "text-amber-300/95"
    : paused
      ? "text-muted-foreground"
      : "text-muted-foreground/60";

  return (
    <div className="flex flex-col gap-2.5 px-4 py-2.5">
      <p className="text-[10.5px] leading-snug text-muted-foreground/70">
        Las sesiones de foco registran tiempo dedicado a una tarea o proyecto. El historial queda en Timeline.
      </p>
      <div className="flex flex-wrap items-center gap-3 gap-y-1.5">
        <div className="flex items-center gap-2">
          <Clock
            className={cn("h-4 w-4", running ? "text-amber-400" : "text-muted-foreground/55")}
            aria-hidden
          />
          <span
            className={cn(
              "font-mono text-xl tabular-nums tracking-tight",
              running ? "text-foreground" : "text-foreground/70",
            )}
            aria-live="polite"
          >
            {formatElapsed(session.elapsed)}
          </span>
        </div>

        <span
          className={cn(
            "rounded-md border border-border/30 bg-background/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
            stateClass,
          )}
        >
          {stateLabel}
        </span>

        <span className="truncate text-[11px] text-muted-foreground">
          {session.project
            ? `Proyecto activo: ${session.project}`
            : projectName
              ? `Proyecto activo: ${projectName}`
              : "Sin proyecto activo"}
        </span>

        <div className="ml-auto flex flex-wrap gap-1.5">
          {idle && (
            <button
              type="button"
              onClick={onStart}
              className="flex h-7 items-center gap-1.5 rounded-md border border-violet-500/25 bg-violet-500/10 px-2.5 text-[11px] font-medium text-violet-300 transition-colors hover:bg-violet-500/15"
            >
              <Play className="h-3 w-3" />
              Iniciar
            </button>
          )}
          {running && (
            <button
              type="button"
              onClick={onPause}
              className="flex h-7 items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/15"
            >
              <Pause className="h-3 w-3" />
              Pausar
            </button>
          )}
          {paused && (
            <button
              type="button"
              onClick={onResume}
              className="flex h-7 items-center gap-1.5 rounded-md border border-violet-500/25 bg-violet-500/10 px-2.5 text-[11px] font-medium text-violet-300 transition-colors hover:bg-violet-500/15"
            >
              <Play className="h-3 w-3" />
              Reanudar
            </button>
          )}
          {(running || paused) && (
            <button
              type="button"
              onClick={onEnd}
              className="flex h-7 items-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/10 px-2.5 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/15"
            >
              <Square className="h-3 w-3" />
              Finalizar
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border/25 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Tarea activa
        </span>
        {activeCard ? (
          <>
            <span className="truncate text-[12px] text-foreground/85">{activeCard.title}</span>
            <span className="shrink-0 rounded border border-border/30 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {activeCard.status}
            </span>
            <button
              type="button"
              onClick={() => focusCardById(activeCard.id)}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border/30 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
              title="Localizar tarjeta en el board"
            >
              <Crosshair className="h-3 w-3" />
              Localizar
            </button>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground/65">
            Sin card seleccionada · elige una tarjeta del board para vincularla.
          </span>
        )}
      </div>
    </div>
  );
}
