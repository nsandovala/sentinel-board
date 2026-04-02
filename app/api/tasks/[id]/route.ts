import { NextRequest, NextResponse } from "next/server";
import { loadAgentOutput } from "@/lib/server/agent-outputs";
import { projects as defaultProjects } from "@/lib/mock/projects";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const task = await loadAgentOutput(id, defaultProjects);

    if (!task) {
      return NextResponse.json(
        { ok: false, error: `Task ${id} not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, task });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error leyendo output" },
      { status: 500 },
    );
  }
}
