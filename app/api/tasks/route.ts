import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskChecklistItems, events } from "@/lib/db/schema";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { syncBus } from "@/lib/server/sync-bus";
import { assembleCard } from "@/lib/server/assemble-card";
import {
  getTasksQuerySchema,
  escapeLikePattern,
  flattenZodIssues,
} from "@/lib/validation/tasks";
import type { SentinelCard } from "@/types/card";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const rawQuery = Object.fromEntries(req.nextUrl.searchParams.entries());

    let query;
    try {
      query = getTasksQuerySchema.parse(rawQuery);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { ok: false, error: `Invalid query: ${flattenZodIssues(err)}` },
          { status: 400 },
        );
      }
      throw err;
    }

    const conditions: SQL[] = [];
    if (query.projectId) conditions.push(eq(tasks.projectId, query.projectId));
    if (query.status) conditions.push(eq(tasks.status, query.status));
    if (query.priority) conditions.push(eq(tasks.priority, query.priority));
    if (query.type) conditions.push(eq(tasks.type, query.type));
    if (query.blocked !== undefined) conditions.push(eq(tasks.blocked, query.blocked));

    if (query.q) {
      const pattern = `%${escapeLikePattern(query.q)}%`;
      const titleMatch = ilike(tasks.title, pattern);
      const descriptionMatch = ilike(tasks.description, pattern);
      const combined = or(titleMatch, descriptionMatch);
      if (combined) conditions.push(combined);
    }

    if (query.tag) {
      // jsonb containment: tags @> '["frontend"]'::jsonb — uses GIN index if present.
      conditions.push(
        sql`${tasks.tags} @> ${JSON.stringify([query.tag])}::jsonb`,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const taskRows = await db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(desc(tasks.updatedAt), desc(tasks.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    let checklistByTask = new Map<string, (typeof taskChecklistItems.$inferSelect)[]>();
    if (taskRows.length > 0) {
      const taskIds = taskRows.map((row) => row.id);
      const checklistRows = await db
        .select()
        .from(taskChecklistItems)
        .where(inArray(taskChecklistItems.taskId, taskIds));

      checklistByTask = new Map();
      for (const ci of checklistRows) {
        const arr = checklistByTask.get(ci.taskId) ?? [];
        arr.push(ci);
        checklistByTask.set(ci.taskId, arr);
      }
    }

    const cards: SentinelCard[] = taskRows.map((row) =>
      assembleCard(row, checklistByTask.get(row.id) ?? []),
    );

    return NextResponse.json({ ok: true, tasks: cards });
  } catch (err) {
    console.error("[GET /api/tasks]", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
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

    await db.insert(tasks)
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
      });

    if (body.checklist?.length) {
      for (let i = 0; i < body.checklist.length; i++) {
        const item = body.checklist[i];
        await db.insert(taskChecklistItems)
          .values({
            id: item.id,
            taskId: body.id,
            text: item.text,
            status: item.status,
            sortOrder: i,
          });
      }
    }

    await db.insert(events)
      .values({
        id: `ev-${Date.now()}`,
        type: "command",
        message: `Tarea creada: "${body.title}"`,
      });

    syncBus.emitTaskCreated(body.id, { projectId: body.projectId });

    const [inserted] = await db.select().from(tasks).where(eq(tasks.id, body.id)).limit(1);
    const checklist = await db
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, body.id));

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
