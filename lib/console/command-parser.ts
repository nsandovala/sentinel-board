import type { CommandAction, ParsedCommand } from "@/types/command";

interface PatternRule {
  action: CommandAction;
  patterns: RegExp[];
  extract: (match: RegExpMatchArray, raw: string) => Partial<ParsedCommand>;
}

const rules: PatternRule[] = [
  {
    action: "move_status",
    patterns: [
      /mover\s+(.+?)\s+a\s+(.+)/i,
      /cambiar\s+(.+?)\s+a\s+(.+)/i,
      /pasar\s+(.+?)\s+a\s+(.+)/i,
    ],
    extract: (match) => ({
      target: match[1]?.trim(),
      value: match[2]?.trim(),
    }),
  },
  {
    action: "create_task",
    patterns: [
      /crear\s+tarea\s+(.+?)(?:\s+en\s+(.+))?$/i,
      /nueva\s+tarea\s+(.+?)(?:\s+en\s+(.+))?$/i,
      /agregar\s+tarea\s+(.+?)(?:\s+en\s+(.+))?$/i,
    ],
    extract: (match) => ({
      target: match[1]?.trim(),
      project: match[2]?.trim(),
    }),
  },
  {
    action: "log_time",
    patterns: [
      /registrar\s+(\d+)\s*(?:hora|horas|h)\s+(?:en\s+)?(.+)/i,
      /loguear\s+(\d+)\s*(?:hora|horas|h)\s+(?:en\s+)?(.+)/i,
    ],
    extract: (match) => ({
      value: match[1]?.trim(),
      project: match[2]?.trim(),
    }),
  },
  {
    action: "start_focus",
    patterns: [
      /iniciar\s+foco(?:\s+(?:en\s+)?(.+))?$/i,
      /empezar\s+foco(?:\s+(?:en\s+)?(.+))?$/i,
      /focus\s+(?:en\s+)?(.+)/i,
    ],
    extract: (match) => ({
      project: match[1]?.trim(),
    }),
  },
  {
    action: "end_focus",
    patterns: [
      /terminar\s+foco/i,
      /detener\s+foco/i,
      /parar\s+foco/i,
      /end\s+focus/i,
    ],
    extract: () => ({}),
  },
];

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          action: rule.action,
          raw: trimmed,
          ...rule.extract(match, trimmed),
        };
      }
    }
  }

  return { action: "unknown", raw: trimmed };
}
