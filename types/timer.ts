export type FocusState = "idle" | "running" | "paused" | "ended";

export interface FocusSession {
  state: FocusState;
  project?: string;
  startedAt?: Date;
  elapsed: number;
}
