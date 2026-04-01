import { NextRequest, NextResponse } from "next/server";
import runAgent from "@/lib/agents/run-agent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const agent = String(body?.agent ?? "").trim();
    const input = body?.input ?? {};

    if (!agent) {
      return NextResponse.json(
        { ok: false, error: "Missing agent name" },
        { status: 400 }
      );
    }

    const result = await runAgent(agent, input);

    if (!result.ok) {
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}