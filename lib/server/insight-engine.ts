import { db } from "@/lib/db";
import { tasks, systemInsights } from "@/lib/db/schema";
import { syncBus } from "./sync-bus";
import { eq, desc, and, gte } from "drizzle-orm";

export type InsightSeverity = "low" | "medium" | "high" | "critical";
export type InsightStatus = "open" | "dismissed" | "resolved";
export type InsightType =
  | "stale_card"
  | "repeated_block"
  | "high_value_ignored"
  | "focus_without_progress";

export interface CreateInsightInput {
  projectId: string;
  taskId?: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  summary: string;
  evidenceJson?: Record<string, unknown>;
}

export interface InsightEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  type: string;
  severity: InsightSeverity;
  title: string;
  summary: string;
  evidenceJson: Record<string, unknown> | null;
  status: InsightStatus;
  createdAt: string;
  updatedAt: string;
}

function sanitizeText(text: string): string {
  return text
    .slice(0, 1000)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim();
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function createInsight(input: CreateInsightInput): Promise<InsightEntry> {
  const id = `ins-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const [row] = await db.insert(systemInsights)
    .values({
      id,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      type: input.type,
      severity: input.severity,
      title: sanitizeText(input.title),
      summary: sanitizeText(input.summary),
      evidenceJson: input.evidenceJson ?? null,
    })
    .returning();

  syncBus.emitInsightCreated(id, { projectId: input.projectId });

  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    type: row.type,
    severity: row.severity as InsightSeverity,
    title: row.title,
    summary: row.summary,
    evidenceJson: row.evidenceJson as Record<string, unknown> | null,
    status: row.status as InsightStatus,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export async function listInsights(options?: {
  projectId?: string;
  status?: InsightStatus;
}): Promise<InsightEntry[]> {
  const conditions = [];

  if (options?.projectId) {
    conditions.push(eq(systemInsights.projectId, options.projectId));
  }
  if (options?.status) {
    conditions.push(eq(systemInsights.status, options.status));
  }

  const rows = await db
    .select()
    .from(systemInsights)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(systemInsights.createdAt));

  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    type: row.type,
    severity: row.severity as InsightSeverity,
    title: row.title,
    summary: row.summary,
    evidenceJson: row.evidenceJson as Record<string, unknown> | null,
    status: row.status as InsightStatus,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

export async function updateInsightStatus(
  id: string,
  status: InsightStatus,
): Promise<InsightEntry | null> {
  const updatedAt = new Date();
  await db.update(systemInsights)
    .set({ status, updatedAt })
    .where(eq(systemInsights.id, id));

  syncBus.emitInsightUpdated(id, { status });

  const [row] = await db.select().from(systemInsights).where(eq(systemInsights.id, id)).limit(1);
  if (!row) return null;

  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    type: row.type,
    severity: row.severity as InsightSeverity,
    title: row.title,
    summary: row.summary,
    evidenceJson: row.evidenceJson as Record<string, unknown> | null,
    status: row.status as InsightStatus,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function getDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function detectStaleCards(projectId: string): Promise<CreateInsightInput[]> {
  const staleDays = 14;
  const cutoff = getDaysAgo(staleDays);

  const stale = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, "en_proceso"),
        gte(tasks.updatedAt, cutoff),
      ),
    );

  const results: CreateInsightInput[] = [];
  for (const task of stale) {
    const updated = task.updatedAt instanceof Date ? task.updatedAt.getTime() : new Date(task.updatedAt).getTime();
    const now = Date.now();
    const daysStale = Math.floor((now - updated) / (1000 * 60 * 60 * 24));

    if (daysStale >= staleDays) {
      results.push({
        projectId,
        taskId: task.id,
        type: "stale_card",
        severity: daysStale >= 30 ? "high" : "medium",
        title: `Tarea stale: "${task.title}"`,
        summary: `Sin movimiento por ${daysStale} días en en_proceso`,
        evidenceJson: { daysStale, lastUpdate: toIsoString(task.updatedAt), status: task.status },
      });
    }
  }

  return results;
}

export async function detectRepeatedBlocks(projectId: string): Promise<CreateInsightInput[]> {
  const blockedTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.blocked, true)));

  const blockedByCount = new Map<string, number>();
  for (const task of blockedTasks) {
    const reason = task.blockerReason ?? "sin razón";
    blockedByCount.set(reason, (blockedByCount.get(reason) ?? 0) + 1);
  }

  const results: CreateInsightInput[] = [];
  for (const [reason, count] of blockedByCount) {
    if (count >= 3) {
      results.push({
        projectId,
        type: "repeated_block",
        severity: count >= 5 ? "high" : "medium",
        title: `Bloqueos recurrentes: "${reason.slice(0, 50)}"`,
        summary: `${count} tareas bloqueadas por la misma razón`,
        evidenceJson: { reason, count },
      });
    }
  }

  return results;
}

export async function detectHighValueIgnored(projectId: string): Promise<CreateInsightInput[]> {
  const allFeedback = await db
    .select()
    .from(systemInsights)
    .where(eq(systemInsights.projectId, projectId));

  const relevantInsights = allFeedback.filter(
    (i) => i.type === "high_value_ignored" && i.status === "open",
  );

  const results: CreateInsightInput[] = [];

  if (relevantInsights.length >= 5) {
    results.push({
      projectId,
      type: "high_value_ignored",
      severity: "high",
      title: "Múltiples insights de alto valor ignorados",
      summary: `${relevantInsights.length} insights abiertos sin acción`,
      evidenceJson: { count: relevantInsights.length },
    });
  }

  return results;
}

export async function detectFocusWithoutTaskProgress(projectId: string): Promise<CreateInsightInput[]> {
  const [recentFocus] = await db
    .select()
    .from(systemInsights)
    .where(and(eq(systemInsights.projectId, projectId), eq(systemInsights.type, "focus_without_progress")))
    .orderBy(desc(systemInsights.createdAt))
    .limit(1);

  if (recentFocus) {
    const created = recentFocus.createdAt instanceof Date ? recentFocus.createdAt.getTime() : new Date(recentFocus.createdAt).getTime();
    const hoursSince = (Date.now() - created) / (1000 * 60 * 60);
    if (hoursSince < 24) return [];
  }

  const recentlyCompleted = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, "listo"),
        gte(tasks.updatedAt, getDaysAgo(1)),
      ),
    );

  const noRecentFocus = await db
    .select()
    .from(systemInsights)
    .where(
      and(
        eq(systemInsights.projectId, projectId),
        eq(systemInsights.type, "focus_without_progress"),
        gte(systemInsights.createdAt, getDaysAgo(1)),
      ),
    );

  if (recentlyCompleted.length > 0 && noRecentFocus.length === 0) {
    return [{
      projectId,
      type: "focus_without_progress",
      severity: "low",
      title: "Actividad reciente sin sesión de foco activa",
      summary: `Hay ${recentlyCompleted.length} tareas en estado 'listo' pero no hay sesiones de foco recientes`,
      evidenceJson: { completedCount: recentlyCompleted.length },
    }];
  }

  return [];
}

export async function runInsightEngine(projectId: string): Promise<InsightEntry[]> {
  const rules = [
    detectStaleCards,
    detectRepeatedBlocks,
    detectHighValueIgnored,
    detectFocusWithoutTaskProgress,
  ];

  const insights: InsightEntry[] = [];

  for (const rule of rules) {
    try {
      const results = await rule(projectId);
      for (const input of results) {
        const [existing] = await db
          .select()
          .from(systemInsights)
          .where(
            and(
              eq(systemInsights.projectId, projectId),
              eq(systemInsights.type, input.type),
              eq(systemInsights.status, "open"),
            ),
          )
          .limit(1);

        if (!existing) {
          const created = await createInsight(input);
          insights.push(created);
        }
      }
    } catch (err) {
      console.error(`Insight rule ${rule.name} failed:`, err);
    }
  }

  return insights;
}