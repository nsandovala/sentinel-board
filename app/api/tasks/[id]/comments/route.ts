import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { cardComments, tasks } from "@/lib/db/schema";
import { rejectIfUnauthorized } from "@/lib/server/request-guard";
import {
  postCommentBodySchema,
  extractCommentBody,
  flattenZodIssues,
} from "@/lib/validation/tasks";
import type { CardComment } from "@/types/comment";

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

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const rows = await db
      .select()
      .from(cardComments)
      .where(eq(cardComments.cardId, id))
      .orderBy(asc(cardComments.createdAt));

    const comments: CardComment[] = rows.map((r) => ({
      id: r.id,
      cardId: r.cardId,
      author: r.author,
      body: r.body,
      type: r.type as CardComment["type"],
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }));

    return NextResponse.json({ ok: true, comments });
  } catch (err) {
    console.error("[GET /api/tasks/:id/comments]", err);
    return internalError();
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const denied = rejectIfUnauthorized(req);
    if (denied) return denied;

    const { id } = await params;

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    let body;
    try {
      body = postCommentBodySchema.parse(rawBody);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return badRequest(`Invalid body: ${flattenZodIssues(err)}`);
      }
      throw err;
    }

    const message = extractCommentBody(body);
    if (!message) return badRequest("body, content or text is required");

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!task) return notFound();

    const comment: CardComment = {
      id: body.id || `cmt-${randomUUID()}`,
      cardId: id,
      author: body.author?.trim() || "user",
      body: message,
      type: body.type || "comment",
      createdAt: new Date().toISOString(),
    };

    await db.insert(cardComments).values({
      id: comment.id,
      cardId: comment.cardId,
      author: comment.author,
      body: comment.body,
      type: comment.type,
    });

    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    console.error("[POST /api/tasks/:id/comments]", err);
    return internalError();
  }
}
