export type EventType = "command" | "system" | "heo_suggestion" | "focus";

export interface DockEvent {
  id: string;
  type: EventType;
  message: string;
  timestamp: Date;
}

export interface HeoSuggestion {
  id: string;
  text: string;
  command: string;
}
