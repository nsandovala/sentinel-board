import { NextResponse } from "next/server";
import { loadAgentOutputs } from "@/lib/server/agent-outputs";
import { projects as defaultProjects } from "@/lib/mock/projects";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cards = await loadAgentOutputs(defaultProjects);
    return NextResponse.json({ ok: true, tasks: cards });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error leyendo outputs" },
      { status: 500 },
    );
  }
}
