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

export function createInsight(input: CreateInsightInput): InsightEntry {
  const id = `ins-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const row = db.insert(systemInsights)
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
    .returning()
    .get();

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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listInsights(options?: {
  projectId?: string;
  status?: InsightStatus;
}): InsightEntry[] {
  const conditions = [];

  if (options?.projectId) {
    conditions.push(eq(systemInsights.projectId, options.projectId));
  }
  if (options?.status) {
    conditions.push(eq(systemInsights.status, options.status));
  }

  const rows = db
    .select()
    .from(systemInsights)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(systemInsights.createdAt))
    .all();

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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export function updateInsightStatus(
  id: string,
  status: InsightStatus,
): InsightEntry | null {
  const updatedAt = new Date().toISOString();
  db.update(systemInsights)
    .set({ status, updatedAt })
    .where(eq(systemInsights.id, id))
    .run();

  syncBus.emitInsightUpdated(id, { status });

  const row = db.select().from(systemInsights).where(eq(systemInsights.id, id)).get();
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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function detectStaleCards(projectId: string): CreateInsightInput[] {
  const staleDays = 14;
  const cutoff = getDaysAgo(staleDays);

  const stale = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, "en_proceso"),
        gte(tasks.updatedAt, cutoff),
      ),
    )
    .all();

  const results: CreateInsightInput[] = [];
  for (const task of stale) {
    const updated = new Date(task.updatedAt).getTime();
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
        evidenceJson: { daysStale, lastUpdate: task.updatedAt, status: task.status },
      });
    }
  }

  return results;
}

export function detectRepeatedBlocks(projectId: string): CreateInsightInput[] {
  const blockedTasks = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.blocked, true)))
    .all();

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

export function detectHighValueIgnored(projectId: string): CreateInsightInput[] {
  const allFeedback = db
    .select()
    .from(systemInsights)
    .where(eq(systemInsights.projectId, projectId))
    .all();

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

export function detectFocusWithoutTaskProgress(projectId: string): CreateInsightInput[] {
  const recentFocus = db
    .select()
    .from(systemInsights)
    .where(and(eq(systemInsights.projectId, projectId), eq(systemInsights.type, "focus_without_progress")))
    .orderBy(desc(systemInsights.createdAt))
    .limit(1)
    .get();

  if (recentFocus) {
    const created = new Date(recentFocus.createdAt).getTime();
    const hoursSince = (Date.now() - created) / (1000 * 60 * 60);
    if (hoursSince < 24) return [];
  }

  const recentlyCompleted = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, "listo"),
        gte(tasks.updatedAt, getDaysAgo(1)),
      ),
    )
    .all();

  const noRecentFocus = db
    .select()
    .from(systemInsights)
    .where(
      and(
        eq(systemInsights.projectId, projectId),
        eq(systemInsights.type, "focus_without_progress"),
        gte(systemInsights.createdAt, getDaysAgo(1)),
      ),
    )
    .all();

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

export function runInsightEngine(projectId: string): InsightEntry[] {
  const rules = [
    detectStaleCards,
    detectRepeatedBlocks,
    detectHighValueIgnored,
    detectFocusWithoutTaskProgress,
  ];

  const insights: InsightEntry[] = [];

  for (const rule of rules) {
    try {
      const results = rule(projectId);
      for (const input of results) {
        const existing = db
          .select()
          .from(systemInsights)
          .where(
            and(
              eq(systemInsights.projectId, projectId),
              eq(systemInsights.type, input.type),
              eq(systemInsights.status, "open"),
            ),
          )
          .get();

        if (!existing) {
          const created = createInsight(input);
          insights.push(created);
        }
      }
    } catch (err) {
      console.error(`Insight rule ${rule.name} failed:`, err);
    }
  }

  return insights;
}