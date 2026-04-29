import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskChecklistItems, events } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { analyzeRootCause } from "@/lib/server/root-cause-analyzer";
import { logDockEvent } from "@/lib/server/log-event";
import type { RootCauseInput } from "@/types/root-cause";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<RootCauseInput>;

    if (!body.symptom && !body.taskId) {
      return NextResponse.json(
        { ok: false, error: "symptom or taskId is required" },
        { status: 400 },
      );
    }

    let input: RootCauseInput = {
      symptom: body.symptom ?? "",
      taskId: body.taskId,
      projectId: body.projectId,
      recentEvents: body.recentEvents,
      currentStatus: body.currentStatus,
      metadata: body.metadata,
    };

    if (body.taskId && !body.metadata) {
      const [card] = await db.select().from(tasks).where(eq(tasks.id, body.taskId)).limit(1);
      if (card) {
        const recentEventsRows = await db
          .select()
          .from(events)
          .orderBy(desc(events.createdAt))
          .limit(10);
        const recentEvts = recentEventsRows
          .filter((e) => e.message.includes(card.title))
          .map((e) => e.message);

        const checklist = await db
          .select()
          .from(taskChecklistItems)
          .where(eq(taskChecklistItems.taskId, card.id));

        input = {
          ...input,
          symptom: input.symptom || `Diagnóstico de "${card.title}"`,
          currentStatus: card.status,
          projectId: card.projectId,
          recentEvents: recentEvts.length > 0 ? recentEvts : input.recentEvents,
          metadata: {
            title: card.title,
            blocked: card.blocked,
            blockerReason: card.blockerReason ?? undefined,
            priority: card.priority,
            type: card.type,
            tags: (card.tags ?? []) as string[],
            checklistTotal: checklist.length,
            checklistDone: checklist.filter((c) => c.status === "done").length,
            createdAt: card.createdAt,
            description: card.description ?? undefined,
          },
        };
      }
    }

    const analysis = analyzeRootCause(input);

    const sevLabel = analysis.severidad === "critica" ? "CRITICA"
      : analysis.severidad === "alta" ? "ALTA"
      : analysis.severidad === "media" ? "MEDIA" : "BAJA";
    await logDockEvent(
      "system",
      `Root cause [${sevLabel}]: ${analysis.causa_raiz.slice(0, 120)}`,
    );

    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    console.error("Root cause analysis error:", err);
    await logDockEvent("system", `Root cause analysis error: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Analysis error" },
      { status: 500 },
    );
  }
}
