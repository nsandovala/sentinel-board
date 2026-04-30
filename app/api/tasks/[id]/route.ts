import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logDockEvent } from "@/lib/server/log-event";
import { rejectIfUnauthorized } from "@/lib/server/request-guard";
import { validateTaskPatch } from "@/lib/server/task-validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext,
) {
  try {
    const denied = rejectIfUnauthorized(req);
    if (denied) return denied;

    const { id } = await params;

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    await db.delete(tasks).where(eq(tasks.id, id));

    await logDockEvent("command", `Tarea eliminada: "${existing.title}"`);

    return NextResponse.json({ ok: true, deleted: { id, title: existing.title } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB delete error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = rejectIfUnauthorized(req);
    if (denied) return denied;

    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    const normalized = validateTaskPatch(body);
    if (!normalized.ok) {
      return NextResponse.json(
        { ok: false, error: normalized.error },
        { status: 400 },
      );
    }

    const updates: Partial<typeof tasks.$inferInsert> = {
      ...normalized.value,
      updatedAt: new Date().toISOString(),
    };

    await db.update(tasks).set(updates).where(eq(tasks.id, id));

    if (normalized.value.status && normalized.value.status !== existing.status) {
      await logDockEvent("command", `"${existing.title}" -> ${normalized.value.status}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB update error" },
      { status: 500 },
    );
  }
}
