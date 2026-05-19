import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { tasks, taskChecklistItems, events } from "@/lib/db/schema";
import { syncBus } from "@/lib/server/sync-bus";
import { loadCardById } from "@/lib/server/assemble-card";
import {
  patchTaskBodySchema,
  flattenZodIssues,
  type PatchTaskBody,
} from "@/lib/validation/tasks";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function notFound() {
  return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
}

function internalError() {
  return NextResponse.json(
    { ok: false, error: "Internal error" },
    { status: 500 },
  );
}

function buildUpdatePayload(body: PatchTaskBody): Record<string, unknown> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.type !== undefined) updates.type = body.type;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.blocked !== undefined) updates.blocked = body.blocked;
  if (body.blockerReason !== undefined) updates.blockerReason = body.blockerReason;
  if (body.codexLoop !== undefined) updates.codexLoop = body.codexLoop;
  if (body.fiveWhys !== undefined) updates.fiveWhys = body.fiveWhys;
  if (body.moneyCode !== undefined) updates.moneyCode = body.moneyCode;

  return updates;
}

async function replaceChecklist(
  taskId: string,
  checklist: NonNullable<PatchTaskBody["checklist"]>,
): Promise<void> {
  await db.delete(taskChecklistItems).where(eq(taskChecklistItems.taskId, taskId));
  if (checklist.length === 0) return;
  await db.insert(taskChecklistItems).values(
    checklist.map((item, idx) => ({
      id: item.id,
      taskId,
      text: item.text,
      status: item.status,
      sortOrder: idx,
    })),
  );
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    let body: PatchTaskBody;
    try {
      body = patchTaskBodySchema.parse(rawBody);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { ok: false, error: `Invalid body: ${flattenZodIssues(err)}` },
          { status: 400 },
        );
      }
      throw err;
    }

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!existing) return notFound();

    await db.update(tasks).set(buildUpdatePayload(body)).where(eq(tasks.id, id));

    if (body.checklist !== undefined) {
      await replaceChecklist(id, body.checklist);
    }

    if (body.status && body.status !== existing.status) {
      await db.insert(events).values({
        id: `ev-${Date.now()}`,
        type: "command",
        message: `"${existing.title}" → ${body.status}`,
      });
    }

    syncBus.emitTaskUpdated(id, {
      projectId: existing.projectId,
      changes: Object.keys(body),
    });

    const task = await loadCardById(id);
    if (!task) return notFound();

    return NextResponse.json({ ok: true, task });
  } catch (err) {
    console.error("[PATCH /api/tasks/:id]", err);
    return internalError();
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!existing) return notFound();

    await db.delete(tasks).where(eq(tasks.id, id));

    await db.insert(events).values({
      id: `ev-${Date.now()}`,
      type: "command",
      message: `Tarea eliminada: "${existing.title}"`,
    });

    syncBus.emitTaskDeleted(id, { projectId: existing.projectId });

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error("[DELETE /api/tasks/:id]", err);
    return internalError();
  }
}
