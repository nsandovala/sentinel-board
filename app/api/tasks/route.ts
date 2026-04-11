import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskChecklistItems, events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
  };
}

export async function GET() {
  try {
    const allTasks = db.select().from(tasks).all();
    const allChecklist = db.select().from(taskChecklistItems).all();

    const checklistByTask = new Map<string, (typeof taskChecklistItems.$inferSelect)[]>();
    for (const ci of allChecklist) {
      const arr = checklistByTask.get(ci.taskId) ?? [];
      arr.push(ci);
      checklistByTask.set(ci.taskId, arr);
    }

    const cards: SentinelCard[] = allTasks.map((t) =>
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
    const body = (await req.json()) as Partial<SentinelCard>;
    if (!body.id || !body.title || !body.projectId) {
      return NextResponse.json(
        { ok: false, error: "id, title, and projectId are required" },
        { status: 400 },
      );
    }

    db.insert(tasks)
      .values({
        id: body.id,
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? "idea_bruta",
        type: body.type ?? "task",
        priority: body.priority ?? "medium",
        tags: body.tags ?? [],
        projectId: body.projectId,
        blocked: body.blocked ?? false,
        blockerReason: body.blockerReason ?? null,
        codexLoop: (body.codexLoop as Record<string, string | undefined>) ?? null,
        fiveWhys: (body.fiveWhys as Record<string, string | undefined>) ?? null,
        moneyCode: (body.moneyCode as unknown as Record<string, number | undefined>) ?? null,
      })
      .run();

    if (body.checklist?.length) {
      for (let i = 0; i < body.checklist.length; i++) {
        const item = body.checklist[i];
        db.insert(taskChecklistItems)
          .values({
            id: item.id,
            taskId: body.id,
            text: item.text,
            status: item.status,
            sortOrder: i,
          })
          .run();
      }
    }

    db.insert(events)
      .values({
        id: `ev-${Date.now()}`,
        type: "command",
        message: `Tarea creada: "${body.title}"`,
      })
      .run();

    const inserted = db.select().from(tasks).where(eq(tasks.id, body.id)).get();
    const checklist = db
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, body.id))
      .all();

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
