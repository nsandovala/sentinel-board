import { NextRequest, NextResponse } from "next/server";
import {
  ProjectNotFoundError,
  createAgentInput,
  validateAgentInput,
} from "@/lib/server/agent-inputs";
import { rejectIfUnauthorized } from "@/lib/server/request-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const denied = rejectIfUnauthorized(req);
    if (denied) return denied;

    const body = await req.json();
    const normalized = validateAgentInput(body);

    if (!normalized.ok) {
      return NextResponse.json(
        { ok: false, error: normalized.error },
        { status: 400 },
      );
    }

    const created = await createAgentInput(normalized.value);

    return NextResponse.json({
      ok: true,
      ...created,
    });
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Agent input write error",
      },
      { status: 500 },
    );
  }
}
