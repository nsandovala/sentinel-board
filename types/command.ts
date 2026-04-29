export type CommandAction =
  | "move_status"
  | "create_task"
  | "log_time"
  | "start_focus"
  | "end_focus"
  | "unknown";

export interface ParsedCommand {
  action: CommandAction;
  target?: string;
  project?: string;
  value?: string;
  raw: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  timestamp: Date;
  action: CommandAction;
}
