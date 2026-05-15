"use client";

import { useMemo } from "react";
import { CommandInput, type LiveCommandFeedback } from "@/components/console/command-input";
import { CommandLog } from "@/components/console/command-log";
import { CommandSuggestions } from "@/components/console/command-suggestions";
import { QuickActions } from "@/components/console/quick-actions";
import { parseCommandLine, type CommandIntent } from "@/lib/console/command-parser";
import type { HeoSuggestion } from "@/types/event";

const LIVE_INTENT_ES: Record<CommandIntent, string> = {
  create_task: "Crear tarea",
  move_status: "Mover tarjeta",
  start_focus: "Iniciar foco",
  end_focus: "Terminar foco",
  log_time: "Registrar tiempo",
  analyze: "Analizar (otra pestaña)",
  unknown: "Sin clasificar",
};

const COMMAND_FORMAT_HINT =
  "Plantillas: crear tarea [título] en [proyecto] · mover «título» a [estado] · registrar [n] horas en [proyecto] · iniciar/terminar foco";

const QUICK_HELP: { token: string; description: string }[] = [
  { token: "create", description: "crear tarea …" },
  { token: "move", description: "mover «titulo» a [estado]" },
  { token: "focus", description: "iniciar/terminar foco" },
  { token: "analyze", description: "ir a tab Analyze" },
];

interface CommandModeProps {
  expanded: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFocus: () => void;
  onSuggestionPick: (command: string) => void;
  onOpenCreateTask: () => void;
  onOpenMoveState: () => void;
  onFocusStart: () => void;
  onFocusEnd: () => void;
  focusRunning: boolean;
  tabHints: string[];
  liveSuggestions: HeoSuggestion[];
}

export function CommandMode({
  expanded,
  value,
  onChange,
  onSubmit,
  onFocus,
  onSuggestionPick,
  onOpenCreateTask,
  onOpenMoveState,
  onFocusStart,
  onFocusEnd,
  focusRunning,
  tabHints,
  liveSuggestions,
}: CommandModeProps) {
  const liveFeedback = useMemo<LiveCommandFeedback | null>(() => {
    if (!value.trim()) return null;
    const outcome = parseCommandLine(value);
    if (!outcome.readyToExecute) {
      return { tone: "warning", lines: outcome.helpLines.slice(0, 2) };
    }
    if (outcome.parsed.action !== "unknown") {
      return {
        tone: "ready",
        lines: [`${LIVE_INTENT_ES[outcome.intent]} — reconocido · Enter para ejecutar`],
      };
    }
    return {
      tone: "muted",
      lines: [
        outcome.intent !== "unknown"
          ? `Pista: ${LIVE_INTENT_ES[outcome.intent]} · Enter intentará ejecutar o mostrará ayuda en el registro`
          : "Enter ejecuta; si no encaja un patrón verás formatos sugeridos abajo en el registro.",
      ],
    };
  }, [value]);

  return (
    <>
      <div className="flex min-h-10 items-start gap-2 px-1 py-0.5">
        <div className="min-w-0 flex-1">
          <CommandInput
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            onFocus={onFocus}
            suggestions={tabHints}
            formatHint={expanded ? COMMAND_FORMAT_HINT : undefined}
            liveFeedback={liveFeedback}
          />
          {!expanded && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 px-4 pl-[2.25rem] text-[10px] text-muted-foreground/55">
              {QUICK_HELP.map((h) => (
                <span key={h.token}>
                  <span className="text-foreground/70">{h.token}</span> · {h.description}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-border/30 px-4 pb-3 pt-2">
          <div className="flex max-h-72 min-h-0 flex-col gap-2 overflow-hidden">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Registro del dock
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CommandLog />
            </div>
          </div>

          <div className="flex w-56 flex-col gap-4">
            <CommandSuggestions suggestions={liveSuggestions} onSelect={onSuggestionPick} />
            <QuickActions
              onFocusStart={onFocusStart}
              onFocusEnd={onFocusEnd}
              onOpenCreateTask={onOpenCreateTask}
              onOpenMoveState={onOpenMoveState}
              focusRunning={focusRunning}
            />
          </div>
        </div>
      )}
    </>
  );
}
