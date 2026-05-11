import { NextRequest, NextResponse } from "next/server";
import { runInsightEngine } from "@/lib/server/insight-engine";

export const dynamic = "force-dynamic";

interface RunBody {
  projectId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RunBody;

    if (!body.projectId) {
      return NextResponse.json(
        { ok: false, error: "projectId is required" },
        { status: 400 },
      );
    }

    const insights = await runInsightEngine(body.projectId);

    return NextResponse.json({ ok: true, insights, count: insights.length });
  } catch (err) {
    console.error("Insights run error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}