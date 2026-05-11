import { db } from "@/lib/db";
import { suggestionFeedback } from "@/lib/db/schema";
import { syncBus } from "./sync-bus";
import { eq, desc, and } from "drizzle-orm";

export interface CreateFeedbackInput {
  projectId: string;
  taskId?: string;
  source: string;
  suggestionType: string;
  content: string;
  decision: "accepted" | "rejected" | "ignored";
}

export interface FeedbackEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  source: string;
  suggestionType: string;
  content: string;
  decision: "accepted" | "rejected" | "ignored";
  createdAt: string;
}

function sanitizeText(text: string): string {
  return text
    .slice(0, 10000)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim();
}

export function createFeedback(input: CreateFeedbackInput): FeedbackEntry {
  const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const row = db.insert(suggestionFeedback)
    .values({
      id,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      source: sanitizeText(input.source),
      suggestionType: sanitizeText(input.suggestionType),
      content: sanitizeText(input.content),
      decision: input.decision,
    })
    .returning()
    .get();

  syncBus.emitFeedbackCreated(id, { projectId: input.projectId });

  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    source: row.source,
    suggestionType: row.suggestionType,
    content: row.content,
    decision: row.decision as FeedbackEntry["decision"],
    createdAt: row.createdAt,
  };
}

export function listFeedback(options?: {
  projectId?: string;
  taskId?: string;
  decision?: "accepted" | "rejected" | "ignored";
}): FeedbackEntry[] {
  const conditions = [];

  if (options?.projectId) {
    conditions.push(eq(suggestionFeedback.projectId, options.projectId));
  }
  if (options?.taskId) {
    conditions.push(eq(suggestionFeedback.taskId, options.taskId));
  }
  if (options?.decision) {
    conditions.push(eq(suggestionFeedback.decision, options.decision));
  }

  const rows = db
    .select()
    .from(suggestionFeedback)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(suggestionFeedback.createdAt))
    .all();

  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    source: row.source,
    suggestionType: row.suggestionType,
    content: row.content,
    decision: row.decision as FeedbackEntry["decision"],
    createdAt: row.createdAt,
  }));
}

export function getFeedbackMetrics(projectId: string): {
  total: number;
  accepted: number;
  rejected: number;
  ignored: number;
  acceptanceRate: number;
} {
  const all = listFeedback({ projectId });
  const accepted = all.filter((f) => f.decision === "accepted").length;
  const rejected = all.filter((f) => f.decision === "rejected").length;
  const ignored = all.filter((f) => f.decision === "ignored").length;
  const total = all.length;
  const decided = accepted + rejected;
  const acceptanceRate = decided > 0 ? Math.round((accepted / decided) * 100) : 0;

  return { total, accepted, rejected, ignored, acceptanceRate };
}