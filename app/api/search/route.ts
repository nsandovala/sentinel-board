import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeEntries, tasks } from "@/lib/db/schema";
import type { KnowledgeEntry, SearchCardResult, SearchResponse } from "@/types/knowledge";

export const dynamic = "force-dynamic";

function mapKnowledge(row: typeof knowledgeEntries.$inferSelect): KnowledgeEntry {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    title: row.title,
    slug: row.slug,
    category: row.category as KnowledgeEntry["category"],
    status: row.status as KnowledgeEntry["status"],
    tags: (row.tags ?? []) as string[],
    summary: row.summary ?? undefined,
    body: row.body,
    sourceTaskId: row.sourceTaskId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCard(row: typeof tasks.$inferSelect): SearchCardResult {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    priority: row.priority,
    type: row.type,
    tags: (row.tags ?? []) as string[],
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const projectId = searchParams.get("projectId")?.trim();
    const status = searchParams.get("status")?.trim();
    const priority = searchParams.get("priority")?.trim();
    const tag = searchParams.get("tag")?.trim().toLowerCase();
    const includeKnowledge = searchParams.get("includeKnowledge") !== "false";
    const limit = Math.min(Number(searchParams.get("limit") ?? "12"), 50);

    const taskConditions = [];
    if (projectId) taskConditions.push(eq(tasks.projectId, projectId));
    if (status) taskConditions.push(eq(tasks.status, status));
    if (priority) taskConditions.push(eq(tasks.priority, priority));
    if (q) {
      taskConditions.push(
        or(
          ilike(tasks.title, `%${q}%`),
          ilike(tasks.description, `%${q}%`),
        )!,
      );
    }

    const taskRows = await db
      .select()
      .from(tasks)
      .where(taskConditions.length > 0 ? and(...taskConditions) : undefined)
      .orderBy(desc(tasks.updatedAt))
      .limit(limit);

    const filteredCards = tag
      ? taskRows.filter((row) => ((row.tags ?? []) as string[]).some((t) => t.toLowerCase() === tag))
      : taskRows;

    let filteredKnowledge: (typeof knowledgeEntries.$inferSelect)[] = [];

    if (includeKnowledge) {
      const knowledgeConditions = [];
      if (projectId) knowledgeConditions.push(eq(knowledgeEntries.projectId, projectId));
      if (q) {
        knowledgeConditions.push(
          or(
            ilike(knowledgeEntries.title, `%${q}%`),
            ilike(knowledgeEntries.summary, `%${q}%`),
            ilike(knowledgeEntries.body, `%${q}%`),
          )!,
        );
      }

      const knowledgeRows = await db
        .select()
        .from(knowledgeEntries)
        .where(knowledgeConditions.length > 0 ? and(...knowledgeConditions) : undefined)
        .orderBy(desc(knowledgeEntries.updatedAt))
        .limit(limit);

      filteredKnowledge = tag
        ? knowledgeRows.filter((row) => ((row.tags ?? []) as string[]).some((t) => t.toLowerCase() === tag))
        : knowledgeRows;
    }

    const response: SearchResponse = {
      ok: true,
      cards: filteredCards.map(mapCard),
      knowledge: filteredKnowledge.map(mapKnowledge),
      total: {
        cards: filteredCards.length,
        knowledge: filteredKnowledge.length,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Search error" },
      { status: 500 },
    );
  }
}
