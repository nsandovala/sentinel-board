import { NextRequest, NextResponse } from "next/server";
import { createFeedback, listFeedback, getFeedbackMetrics } from "@/lib/server/feedback-service";

export const dynamic = "force-dynamic";

const ALLOWED_SOURCES = ["terminal", "board", "system", "agent"];

interface FeedbackBody {
  projectId: string;
  taskId?: string;
  source: string;
  suggestionType: string;
  content: string;
  decision: "accepted" | "rejected" | "ignored";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FeedbackBody;

    if (!body.projectId || !body.source || !body.suggestionType || !body.content || !body.decision) {
      return NextResponse.json(
        { ok: false, error: "projectId, source, suggestionType, content, decision are required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_SOURCES.includes(body.source)) {
      return NextResponse.json(
        { ok: false, error: "Invalid source" },
        { status: 400 },
      );
    }

    if (!["accepted", "rejected", "ignored"].includes(body.decision)) {
      return NextResponse.json(
        { ok: false, error: "Invalid decision" },
        { status: 400 },
      );
    }

    if (body.content.length > 10000 || body.suggestionType.length > 100) {
      return NextResponse.json(
        { ok: false, error: "Content too long" },
        { status: 400 },
      );
    }

    const feedback = createFeedback({
      projectId: body.projectId,
      taskId: body.taskId,
      source: body.source,
      suggestionType: body.suggestionType,
      content: body.content,
      decision: body.decision,
    });

    return NextResponse.json({ ok: true, feedback });
  } catch (err) {
    console.error("Feedback POST error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const taskId = searchParams.get("taskId") ?? undefined;
    const decision = searchParams.get("decision") as "accepted" | "rejected" | "ignored" | undefined;
    const metrics = searchParams.get("metrics") === "true";

    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: "projectId is required" },
        { status: 400 },
      );
    }

    const feedback = listFeedback({ projectId, taskId, decision });

    const result: Record<string, unknown> = { ok: true, feedback };
    if (metrics) {
      result.metrics = getFeedbackMetrics(projectId);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Feedback GET error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}