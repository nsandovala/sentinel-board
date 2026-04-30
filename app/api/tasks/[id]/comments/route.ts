import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardComments, tasks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { rejectIfUnauthorized } from "@/lib/server/request-guard";
import type { CardComment } from "@/types/comment";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const rows = await db
      .select()
      .from(cardComments)
      .where(eq(cardComments.cardId, id))
      .orderBy(desc(cardComments.createdAt));

    const comments: CardComment[] = rows.map((r) => ({
      id: r.id,
      cardId: r.cardId,
      author: r.author,
      body: r.body,
      type: r.type as CardComment["type"],
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ ok: true, comments });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB read error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = rejectIfUnauthorized(req);
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json();

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!task) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    if (!body.body?.trim()) {
      return NextResponse.json({ ok: false, error: "body is required" }, { status: 400 });
    }

    const comment: CardComment = {
      id: body.id || `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      cardId: id,
      author: body.author || "user",
      body: body.body.trim(),
      type: body.type || "comment",
      createdAt: new Date().toISOString(),
    };

    await db.insert(cardComments)
      .values({
        id: comment.id,
        cardId: comment.cardId,
        author: comment.author,
        body: comment.body,
        type: comment.type,
      });

    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB write error" },
      { status: 500 },
    );
  }
}
