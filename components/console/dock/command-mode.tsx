"use client";

import { CommandSuggestions } from "@/components/console/command-suggestions";
import { QuickActions } from "@/components/console/quick-actions";
import { CopilotOutput, type CopilotOutputState } from "./copilot-output";
import type { HeoSuggestion } from "@/types/event";

interface CommandModeProps {
  onSuggestionPick: (command: string) => void;
  onOpenCreateTask: () => void;
  onFocusStart: () => void;
  onFocusEnd: () => void;
  focusRunning: boolean;
  liveSuggestions: HeoSuggestion[];
  copilotOutput: CopilotOutputState;
  onApplyCopilotSuggestion: (command: string) => void;
  onDismissCopilotOutput: () => void;
}

export function CommandMode({
  onSuggestionPick,
  onOpenCreateTask,
  onFocusStart,
  onFocusEnd,
  focusRunning,
  liveSuggestions,
  copilotOutput,
  onApplyCopilotSuggestion,
  onDismissCopilotOutput,
}: CommandModeProps) {
  const showHeoBlock = copilotOutput.phase !== "idle";

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {showHeoBlock && (
        <CopilotOutput
          state={copilotOutput}
          onApplySuggestion={onApplyCopilotSuggestion}
          onDismiss={onDismissCopilotOutput}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CommandSuggestions suggestions={liveSuggestions} onSelect={onSuggestionPick} />
        <QuickActions
          onFocusStart={onFocusStart}
          onFocusEnd={onFocusEnd}
          onOpenCreateTask={onOpenCreateTask}
          focusRunning={focusRunning}
        />
        <p className="col-span-full text-[10px] leading-snug text-muted-foreground/75 md:col-span-2">
          El input vive abajo. Si tu mensaje no encaja en un comando, HEO Copilot lo responderá usando el AI router. El historial completo está en Timeline.
        </p>
      </div>
    </div>
  );
}
