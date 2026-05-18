"use client";

import { CommandSuggestions } from "@/components/console/command-suggestions";
import { QuickActions } from "@/components/console/quick-actions";
import type { HeoSuggestion } from "@/types/event";

interface CommandModeProps {
  onSuggestionPick: (command: string) => void;
  onOpenCreateTask: () => void;
  onOpenMoveState: () => void;
  onFocusStart: () => void;
  onFocusEnd: () => void;
  focusRunning: boolean;
  liveSuggestions: HeoSuggestion[];
}

export function CommandMode({
  onSuggestionPick,
  onOpenCreateTask,
  onOpenMoveState,
  onFocusStart,
  onFocusEnd,
  focusRunning,
  liveSuggestions,
}: CommandModeProps) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 py-3 md:grid-cols-2">
      <CommandSuggestions suggestions={liveSuggestions} onSelect={onSuggestionPick} />
      <QuickActions
        onFocusStart={onFocusStart}
        onFocusEnd={onFocusEnd}
        onOpenCreateTask={onOpenCreateTask}
        onOpenMoveState={onOpenMoveState}
        focusRunning={focusRunning}
      />
      <p className="col-span-full text-[10px] leading-snug text-muted-foreground/75 md:col-span-2">
        El input vive abajo y es compartido por todos los modos. El historial completo está en Timeline.
      </p>
    </div>
  );
}
