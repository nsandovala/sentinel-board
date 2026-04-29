import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeEntries } from "@/lib/db/schema";
import type { KnowledgeEntry } from "@/types/knowledge";

export const dynamic = "force-dynamic";

function mapEntry(row: typeof knowledgeEntries.$inferSelect): KnowledgeEntry {
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const projectId = searchParams.get("projectId")?.trim();
    const category = searchParams.get("category")?.trim();
    const status = searchParams.get("status")?.trim();
    const tag = searchParams.get("tag")?.trim().toLowerCase();
    const limit = Math.min(Number(searchParams.get("limit") ?? "25"), 100);

    const conditions = [];
    if (projectId) conditions.push(eq(knowledgeEntries.projectId, projectId));
    if (category) conditions.push(eq(knowledgeEntries.category, category as typeof knowledgeEntries.$inferSelect.category));
    if (status) conditions.push(eq(knowledgeEntries.status, status as typeof knowledgeEntries.$inferSelect.status));
    if (q) {
      conditions.push(
        or(
          ilike(knowledgeEntries.title, `%${q}%`),
          ilike(knowledgeEntries.summary, `%${q}%`),
          ilike(knowledgeEntries.body, `%${q}%`),
        )!,
      );
    }

    const baseRows = await db
      .select()
      .from(knowledgeEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(knowledgeEntries.updatedAt))
      .limit(limit);

    const filtered = tag
      ? baseRows.filter((row) => ((row.tags ?? []) as string[]).some((t) => t.toLowerCase() === tag))
      : baseRows;

    return NextResponse.json({
      ok: true,
      knowledge: filtered.map(mapEntry),
      total: filtered.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Knowledge read error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<KnowledgeEntry>;

    if (!body.id || !body.title || !body.slug || !body.body) {
      return NextResponse.json(
        { ok: false, error: "id, title, slug and body are required" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    await db
      .insert(knowledgeEntries)
      .values({
        id: body.id,
        projectId: body.projectId ?? null,
        title: body.title,
        slug: body.slug,
        category: body.category ?? "note",
        status: body.status ?? "published",
        tags: body.tags ?? [],
        summary: body.summary ?? null,
        body: body.body,
        sourceTaskId: body.sourceTaskId ?? null,
        createdAt: now,
        updatedAt: now,
      });

    return NextResponse.json({ ok: true, id: body.id });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Knowledge write error" },
      { status: 500 },
    );
  }
}
