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
  expanded: boolean;
  session: FocusSession;
  activeCard: SentinelCard | null;
  projectName?: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

export function FocusMode({
  expanded,
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

  const stateLabel = running
    ? "EN CURSO"
    : paused
      ? "EN PAUSA"
      : "DETENIDO";

  const stateClass = running
    ? "text-amber-300/95"
    : paused
      ? "text-muted-foreground"
      : "text-muted-foreground/65";

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Clock className={cn("h-4 w-4", running ? "text-amber-400" : "text-muted-foreground/60")} aria-hidden />
          <span
            className={cn(
              "font-mono text-2xl tabular-nums tracking-tight",
              running ? "text-foreground" : "text-foreground/70",
            )}
            aria-live="polite"
          >
            {formatElapsed(session.elapsed)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", stateClass)}>
            {stateLabel}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {session.project ? `Proyecto: ${session.project}` : projectName ? `Sugerido: ${projectName}` : "Sin proyecto asignado"}
          </span>
        </div>

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
              className="flex h-7 items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-2.5 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/15"
            >
              <Square className="h-3 w-3" />
              Finalizar
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 gap-3 border-t border-border/30 pt-3 md:grid-cols-2">
          <section className="sentinel-glass-panel--subtle rounded-md p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Tarea activa
            </p>
            {activeCard ? (
              <div className="mt-2 space-y-1.5">
                <p className="text-[13px] font-medium text-foreground">{activeCard.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  Estado: {activeCard.status} · Prioridad: {activeCard.priority}
                </p>
                <button
                  type="button"
                  onClick={() => focusCardById(activeCard.id)}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border/30 bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
                >
                  <Crosshair className="h-3 w-3" />
                  Localizar en board
                </button>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Sin card seleccionada. Elegí una tarjeta del board para asociarla a esta sesión.
              </p>
            )}
          </section>

          <section className="sentinel-glass-panel--subtle rounded-md p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Sesión
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-[11px]">
              <dt className="text-muted-foreground">Estado</dt>
              <dd className="text-foreground/85">{stateLabel.toLowerCase()}</dd>
              <dt className="text-muted-foreground">Inicio</dt>
              <dd className="text-foreground/85">
                {session.startedAt
                  ? new Date(session.startedAt).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </dd>
              <dt className="text-muted-foreground">Acumulado</dt>
              <dd className="font-mono tabular-nums text-foreground/85">
                {formatElapsed(session.elapsed)}
              </dd>
            </dl>
            {paused && (
              <p className="mt-3 rounded-md border border-border/30 bg-background/40 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                Pausa local: el contador se congela pero la sesión sigue abierta.
                Al finalizar se registra el acumulado actual.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
