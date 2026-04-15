import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dockCommands } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

interface DockCommandBody {
  action: string;
  target?: string;
  project?: string;
  value?: string;
  raw: string;
  success?: boolean;
  resultMessage?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DockCommandBody;

    if (!body.action || !body.raw) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: action, raw" },
        { status: 400 },
      );
    }

    const id = `dc-${Date.now()}`;

    db.insert(dockCommands)
      .values({
        id,
        action: body.action,
        target: body.target ?? null,
        project: body.project ?? null,
        value: body.value ?? null,
        raw: body.raw,
        success: body.success ?? false,
        resultMessage: body.resultMessage ?? null,
      })
      .run();

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB insert error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const rows = db.select().from(dockCommands).all();
    return NextResponse.json({ ok: true, commands: rows });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB read error" },
      { status: 500 },
    );
  }
}
