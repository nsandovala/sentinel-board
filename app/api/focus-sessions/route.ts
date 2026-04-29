import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { focusSessions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { logDockEvent } from "@/lib/server/log-event";

export const dynamic = "force-dynamic";

type SessionState = "idle" | "running" | "paused" | "ended";

interface FocusSessionBody {
  action: "start" | "end" | "pause" | "resume";
  project?: string;
  elapsedSeconds?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FocusSessionBody;

    if (!body.action) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: action" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    if (body.action === "start") {
      const id = `fs-${Date.now()}`;
      await db.insert(focusSessions)
        .values({
          id,
          project: body.project ?? null,
          state: "running",
          startedAt: now,
          elapsedSeconds: 0,
        });

      const label = body.project
        ? `Foco iniciado en ${body.project}`
        : "Foco iniciado";
      await logDockEvent("focus", label);

      return NextResponse.json({ ok: true, id, state: "running" });
    }

    const [current] = await db
      .select()
      .from(focusSessions)
      .where(eq(focusSessions.state, "running"))
      .orderBy(desc(focusSessions.startedAt))
      .limit(1);

    if (!current) {
      return NextResponse.json(
        { ok: false, error: "No active focus session" },
        { status: 404 },
      );
    }

    let newState: SessionState = current.state as SessionState;
    const updates: Partial<typeof focusSessions.$inferInsert> = {};

    if (body.action === "end") {
      newState = "ended";
      updates.state = "ended";
      updates.endedAt = now;
      if (body.elapsedSeconds !== undefined) {
        updates.elapsedSeconds = body.elapsedSeconds;
      }
    } else if (body.action === "pause") {
      newState = "paused";
      updates.state = "paused";
      if (body.elapsedSeconds !== undefined) {
        updates.elapsedSeconds = body.elapsedSeconds;
      }
    } else if (body.action === "resume") {
      newState = "running";
      updates.state = "running";
    }

    await db.update(focusSessions)
      .set(updates)
      .where(eq(focusSessions.id, current.id));

    const proj = current.project;
    if (body.action === "end") {
      const mins = body.elapsedSeconds != null
        ? Math.floor(body.elapsedSeconds / 60)
        : 0;
      const msg = proj
        ? `Foco terminado — ${mins} min en ${proj}`
        : `Foco terminado — ${mins} min`;
      await logDockEvent("focus", msg);
    } else if (body.action === "pause") {
      await logDockEvent("focus", proj ? `Foco pausado en ${proj}` : "Foco pausado");
    } else if (body.action === "resume") {
      await logDockEvent("focus", proj ? `Foco reanudado en ${proj}` : "Foco reanudado");
    }

    return NextResponse.json({ ok: true, id: current.id, state: newState });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(focusSessions)
      .orderBy(desc(focusSessions.startedAt))
      .limit(20);
    return NextResponse.json({ ok: true, sessions: rows });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB read error" },
      { status: 500 },
    );
  }
}
