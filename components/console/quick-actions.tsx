"use client";

import { Play, Square, Plus } from "lucide-react";

interface QuickActionsProps {
  onFocusStart: () => void;
  onFocusEnd: () => void;
  onOpenCreateTask: () => void;
  focusRunning: boolean;
}

export function QuickActions({
  onFocusStart,
  onFocusEnd,
  onOpenCreateTask,
  focusRunning,
}: QuickActionsProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Acciones rápidas
      </span>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onOpenCreateTask}
          className="flex h-7 items-center gap-1.5 rounded-md border border-white/[0.04] bg-[#151515] px-2.5 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-[#1b1b1b] hover:text-foreground/95"
        >
          <Plus className="h-3 w-3" />
          Nueva tarea
        </button>
        {!focusRunning ? (
          <button
            type="button"
            onClick={onFocusStart}
            className="flex h-7 items-center gap-1.5 rounded-md border border-white/[0.04] bg-[#151515] px-2.5 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-[#1b1b1b] hover:text-foreground/95"
          >
            <Play className="h-3 w-3" />
            Iniciar foco
          </button>
        ) : (
          <button
            type="button"
            onClick={onFocusEnd}
            className="flex h-7 items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/[0.05] px-2.5 text-[11px] font-medium text-red-300/85 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <Square className="h-3 w-3" />
            Terminar foco
          </button>
        )}
      </div>
      <p className="px-1 pt-1 text-[10px] leading-snug text-muted-foreground/60">
        Para el resto de operaciones, escribe en el input.
      </p>
    </div>
  );
}
