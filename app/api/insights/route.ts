import { NextRequest, NextResponse } from "next/server";
import { listInsights, updateInsightStatus } from "@/lib/server/insight-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const status = searchParams.get("status") as "open" | "dismissed" | "resolved" | undefined;

    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: "projectId is required" },
        { status: 400 },
      );
    }

    const insights = listInsights({ projectId, status });

    return NextResponse.json({ ok: true, insights });
  } catch (err) {
    console.error("Insights GET error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

interface PatchBody {
  id: string;
  status: "open" | "dismissed" | "resolved";
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as PatchBody;

    if (!body.id || !body.status) {
      return NextResponse.json(
        { ok: false, error: "id and status are required" },
        { status: 400 },
      );
    }

    if (!["open", "dismissed", "resolved"].includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: "Invalid status" },
        { status: 400 },
      );
    }

    const insight = updateInsightStatus(body.id, body.status);

    if (!insight) {
      return NextResponse.json(
        { ok: false, error: "Insight not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, insight });
  } catch (err) {
    console.error("Insights PATCH error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}