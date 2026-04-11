import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import type { Project } from "@/types/project";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = db.select().from(projects).all();

    const result: Project[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description ?? undefined,
      repoUrl: r.repoUrl ?? undefined,
      color: r.color ?? undefined,
      status: r.status as Project["status"],
    }));

    return NextResponse.json({ ok: true, projects: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "DB read error" },
      { status: 500 },
    );
  }
}
