"use client";

import { Play, Square, Clock } from "lucide-react";
import type { FocusSession } from "@/types/timer";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

interface FocusTimerProps {
  session: FocusSession;
  onStart: () => void;
  onEnd: () => void;
}

export function FocusTimer({ session, onStart, onEnd }: FocusTimerProps) {
  const isRunning = session.state === "running";

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Clock className={`h-3 w-3 ${isRunning ? "text-amber-400" : "text-muted-foreground/50"}`} />
        <span
          className={`font-mono text-xs tabular-nums ${
            isRunning ? "text-amber-300" : "text-muted-foreground/50"
          }`}
        >
          {formatElapsed(session.elapsed)}
        </span>
        {session.project && isRunning && (
          <span className="text-[10px] text-muted-foreground/50">
            · {session.project}
          </span>
        )}
      </div>

      {!isRunning ? (
        <button
          type="button"
          onClick={onStart}
          className="flex h-6 items-center gap-1 rounded-md bg-violet-500/15 px-2 text-[11px] font-medium text-violet-400 transition-colors hover:bg-violet-500/25"
        >
          <Play className="h-3 w-3" />
          Foco
        </button>
      ) : (
        <button
          type="button"
          onClick={onEnd}
          className="flex h-6 items-center gap-1 rounded-md bg-red-500/15 px-2 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/25"
        >
          <Square className="h-3 w-3" />
          Terminar
        </button>
      )}
    </div>
  );
}
