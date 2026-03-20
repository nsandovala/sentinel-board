import type { ParsedCommand, CommandResult } from "@/types/command";

type ActionHandler = (cmd: ParsedCommand) => CommandResult;

const handlers: Record<string, ActionHandler> = {
  move_status: (cmd) => ({
    success: true,
    message: `"${cmd.target}" movido a → ${cmd.value}`,
    timestamp: new Date(),
    action: cmd.action,
  }),

  create_task: (cmd) => ({
    success: true,
    message: cmd.project
      ? `Tarea creada: "${cmd.target}" en ${cmd.project}`
      : `Tarea creada: "${cmd.target}"`,
    timestamp: new Date(),
    action: cmd.action,
  }),

  log_time: (cmd) => ({
    success: true,
    message: `${cmd.value}h registradas en ${cmd.project}`,
    timestamp: new Date(),
    action: cmd.action,
  }),

  start_focus: (cmd) => ({
    success: true,
    message: cmd.project
      ? `Foco iniciado en ${cmd.project}`
      : "Foco iniciado",
    timestamp: new Date(),
    action: cmd.action,
  }),

  end_focus: () => ({
    success: true,
    message: "Sesión de foco terminada",
    timestamp: new Date(),
    action: "end_focus",
  }),

  unknown: (cmd) => ({
    success: false,
    message: `Comando no reconocido: "${cmd.raw}"`,
    timestamp: new Date(),
    action: "unknown",
  }),
};

export function executeCommand(parsed: ParsedCommand): CommandResult {
  const handler = handlers[parsed.action] ?? handlers.unknown;
  return handler(parsed);
}
