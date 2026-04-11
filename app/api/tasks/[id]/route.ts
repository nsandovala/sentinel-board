import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface PatchBody {
  status?: string;
  title?: string;
  description?: string | null;
  priority?: string;
  type?: string;
  tags?: string[];
  blocked?: boolean;
  blockerReason?: string | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as PatchBody;

    const existing = db.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.status !== undefined) updates.status = body.status;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.type !== undefined) updates.type = body.type;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.blocked !== undefined) updates.blocked = body.blocked;
    if (body.blockerReason !== undefined) updates.blockerReason = body.blockerReason;

    db.update(tasks).set(updates).where(eq(tasks.id, id)).run();

    if (body.status && body.status !== existing.status) {
      db.insert(events)
        .values({
          id: `ev-${Date.now()}`,
          type: "command",
          message: `"${existing.title}" → ${body.status}`,
        })
        .run();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB update error" },
      { status: 500 },
    );
  }
}
