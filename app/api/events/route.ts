import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { rejectIfUnauthorized } from "@/lib/server/request-guard";
import type { DockEvent } from "@/types/event";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(events);

    const result: DockEvent[] = rows.map((r) => ({
      id: r.id,
      type: r.type as DockEvent["type"],
      message: r.message,
      timestamp: new Date(r.createdAt),
    }));

    return NextResponse.json({ ok: true, events: result });
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

    const body = (await req.json()) as { type?: string; message?: string };
    if (!body.type || !body.message) {
      return NextResponse.json(
        { ok: false, error: "type and message are required" },
        { status: 400 },
      );
    }

    const id = `ev-${Date.now()}`;
    await db.insert(events)
      .values({
        id,
        type: body.type as DockEvent["type"],
        message: body.message,
      });

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB write error" },
      { status: 500 },
    );
  }
}
