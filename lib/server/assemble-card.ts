import { db } from "@/lib/db";
import { tasks, taskChecklistItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { SentinelCard } from "@/types/card";

type TaskRow = typeof tasks.$inferSelect;
type ChecklistRow = typeof taskChecklistItems.$inferSelect;

export function assembleCard(row: TaskRow, checklist: ChecklistRow[]): SentinelCard {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as SentinelCard["status"],
    type: row.type as SentinelCard["type"],
    priority: row.priority as SentinelCard["priority"],
    tags: (row.tags ?? []) as string[],
    projectId: row.projectId,
    checklist: checklist
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((ci) => ({
        id: ci.id,
        text: ci.text,
        status: ci.status as SentinelCard["checklist"][number]["status"],
      })),
    codexLoop: (row.codexLoop as SentinelCard["codexLoop"]) ?? undefined,
    fiveWhys: (row.fiveWhys as SentinelCard["fiveWhys"]) ?? undefined,
    moneyCode: (row.moneyCode as unknown as SentinelCard["moneyCode"]) ?? undefined,
    blocked: row.blocked,
    blockerReason: row.blockerReason ?? undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export async function loadCardById(id: string): Promise<SentinelCard | null> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row) return null;
  const checklist = await db
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, id));
  return assembleCard(row, checklist);
}
