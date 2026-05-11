import { EventEmitter } from "node:events";

export type SSEEventType =
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "focus.started"
  | "focus.ended"
  | "feedback.created"
  | "insight.created"
  | "insight.updated"
  | "refresh";

export interface SSEPayload {
  type: SSEEventType;
  timestamp: string;
  data?: unknown;
}

class SyncBus extends EventEmitter {
  private static instance: SyncBus;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  static getInstance(): SyncBus {
    if (!SyncBus.instance) {
      SyncBus.instance = new SyncBus();
    }
    return SyncBus.instance;
  }

  emitEvent(type: SSEEventType, data?: unknown): void {
    const payload: SSEPayload = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    this.emit("event", payload);
  }

  emitTaskCreated(taskId: string, data?: Record<string, unknown>): void {
    this.emitEvent("task.created", { taskId, ...data });
  }

  emitTaskUpdated(taskId: string, data?: Record<string, unknown>): void {
    this.emitEvent("task.updated", { taskId, ...data });
  }

  emitTaskDeleted(taskId: string, data?: Record<string, unknown>): void {
    this.emitEvent("task.deleted", { taskId, ...data });
  }

  emitFocusStarted(sessionId: string, data?: Record<string, unknown>): void {
    this.emitEvent("focus.started", { sessionId, ...data });
  }

  emitFocusEnded(sessionId: string, data?: Record<string, unknown>): void {
    this.emitEvent("focus.ended", { sessionId, ...data });
  }

  emitFeedbackCreated(feedbackId: string, data?: Record<string, unknown>): void {
    this.emitEvent("feedback.created", { feedbackId, ...data });
  }

  emitInsightCreated(insightId: string, data?: Record<string, unknown>): void {
    this.emitEvent("insight.created", { insightId, ...data });
  }

  emitInsightUpdated(insightId: string, data?: Record<string, unknown>): void {
    this.emitEvent("insight.updated", { insightId, ...data });
  }

  requestRefresh(): void {
    this.emitEvent("refresh");
  }
}

export const syncBus = SyncBus.getInstance();