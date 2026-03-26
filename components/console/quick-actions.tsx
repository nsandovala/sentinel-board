"use client";

import { Play, Square, Plus, ArrowRightLeft } from "lucide-react";

interface QuickActionsProps {
  onFocusStart: () => void;
  onFocusEnd: () => void;
  onOpenCreateTask: () => void;
  onOpenMoveState: () => void;
  focusRunning: boolean;
}

export function QuickActions({
  onFocusStart,
  onFocusEnd,
  onOpenCreateTask,
  onOpenMoveState,
  focusRunning,
}: QuickActionsProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Acciones rápidas
      </span>
      <div className="flex flex-wrap gap-1.5">
        {!focusRunning ? (
          <button
            type="button"
            onClick={onFocusStart}
            className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground/90"
          >
            <Play className="h-3 w-3" />
            Iniciar foco
          </button>
        ) : (
          <button
            type="button"
            onClick={onFocusEnd}
            className="flex h-7 items-center gap-1.5 rounded-md border border-red-500/20 px-2.5 text-[11px] font-medium text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <Square className="h-3 w-3" />
            Terminar foco
          </button>
        )}
        <button
          type="button"
          onClick={onOpenCreateTask}
          className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground/90"
        >
          <Plus className="h-3 w-3" />
          Nueva tarea
        </button>
        <button
          type="button"
          onClick={onOpenMoveState}
          className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground/90"
        >
          <ArrowRightLeft className="h-3 w-3" />
          Mover estado
        </button>
      </div>
    </div>
  );
}
