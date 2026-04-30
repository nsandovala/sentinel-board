import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskChecklistItems } from "@/lib/db/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { logDockEvent } from "@/lib/server/log-event";
import { rejectIfUnauthorized } from "@/lib/server/request-guard";
import { validateTaskCreate } from "@/lib/server/task-validation";
import type { SentinelCard } from "@/types/card";

export const dynamic = "force-dynamic";

function assembleCard(
  row: typeof tasks.$inferSelect,
  checklist: (typeof taskChecklistItems.$inferSelect)[],
): SentinelCard {
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
    createdAt: row.createdAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const projectId = searchParams.get("projectId")?.trim();
    const status = searchParams.get("status")?.trim();
    const priority = searchParams.get("priority")?.trim();
    const tag = searchParams.get("tag")?.trim().toLowerCase();

    const conditions = [];
    if (projectId) conditions.push(eq(tasks.projectId, projectId));
    if (status) conditions.push(eq(tasks.status, status));
    if (priority) conditions.push(eq(tasks.priority, priority));
    if (q) {
      conditions.push(
        or(
          ilike(tasks.title, `%${q}%`),
          ilike(tasks.description, `%${q}%`),
        )!,
      );
    }

    const [allTasks, allChecklist] = await Promise.all([
      db
        .select()
        .from(tasks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(tasks.updatedAt)),
      db.select().from(taskChecklistItems),
    ]);

    const filteredTasks = tag
      ? allTasks.filter((row) => ((row.tags ?? []) as string[]).some((t) => t.toLowerCase() === tag))
      : allTasks;

    const checklistByTask = new Map<string, (typeof taskChecklistItems.$inferSelect)[]>();
    for (const ci of allChecklist) {
      const arr = checklistByTask.get(ci.taskId) ?? [];
      arr.push(ci);
      checklistByTask.set(ci.taskId, arr);
    }

    const cards: SentinelCard[] = filteredTasks.map((t) =>
      assembleCard(t, checklistByTask.get(t.id) ?? []),
    );

    return NextResponse.json({ ok: true, tasks: cards });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB read error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = rejectIfUnauthorized(req);
    if (denied) return denied;

    const body = (await req.json()) as Partial<SentinelCard>;
    const normalized = validateTaskCreate(body);
    if (!normalized.ok) {
      return NextResponse.json(
        { ok: false, error: normalized.error },
        { status: 400 },
      );
    }

    const task = normalized.value;

    await db.insert(tasks)
      .values({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        type: task.type,
        priority: task.priority,
        tags: task.tags,
        projectId: task.projectId,
        blocked: task.blocked,
        blockerReason: task.blockerReason,
        codexLoop: task.codexLoop,
        fiveWhys: task.fiveWhys,
        moneyCode: task.moneyCode,
      });

    if (task.checklist.length) {
      for (let i = 0; i < task.checklist.length; i++) {
        const item = task.checklist[i];
        await db.insert(taskChecklistItems)
          .values({
            id: item.id,
            taskId: task.id,
            text: item.text,
            status: item.status,
            sortOrder: i,
          });
      }
    }

    await logDockEvent("command", `Tarea creada: "${task.title}"`);

    const [inserted] = await db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
    const checklist = await db
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, task.id));

    return NextResponse.json({
      ok: true,
      task: inserted ? assembleCard(inserted, checklist) : null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB write error" },
      { status: 500 },
    );
  }
}
