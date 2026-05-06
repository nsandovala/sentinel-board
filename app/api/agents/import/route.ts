/**
 * POST /api/agents/import
 *
 * Endpoint dedicado para ingesta de tareas provenientes de amon-agents (AA).
 * - Idempotente: la combinación (source, externalTaskId, agent) determina el id interno.
 * - Resuelve projectId por slug `amon_agents` (creándolo si no existe).
 * - Guarda metadata operativa (plan, risks, validations, done_when, score) en
 *   los slots jsonb existentes de la tarea (codexLoop / fiveWhys / moneyCode).
 * - Registra un evento de tipo "system" en la timeline.
 *
 * Diseñado para no romper POST /api/tasks. AA debe migrar a este endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { events, projects, tasks } from "@/lib/db/schema";
import { rejectIfUnauthorized } from "@/lib/server/request-guard";
import { logDockEvent } from "@/lib/server/log-event";

export const dynamic = "force-dynamic";

const STATUS_VALUES = [
  "idea_bruta",
  "clarificando",
  "validando",
  "en_proceso",
  "desarrollo",
  "qa",
  "listo",
  "produccion",
  "archivado",
] as const;

const TYPE_VALUES = [
  "idea",
  "feature",
  "bug",
  "task",
  "decision",
  "experiment",
  "deploy",
  "research",
] as const;

const PRIORITY_VALUES = ["low", "medium", "high", "critical"] as const;

function stringArray(defaultValue: string[] = []) {
  return z
    .union([z.array(z.unknown()), z.undefined()])
    .transform((val) =>
      Array.isArray(val)
        ? val.filter((v): v is string => typeof v === "string")
        : defaultValue,
    )
    .optional()
    .default(defaultValue);
}

const MetadataSchema = z
  .object({
    plan: stringArray(),
    risks: stringArray(),
    validations: stringArray(),
    done_when: stringArray(),
    score: z.coerce.number().min(0).max(100).optional().default(0),
    files_to_touch: stringArray(),
  })
  .passthrough();

const ImportPayloadSchema = z.object({
  source: z.literal("amon-agents"),
  externalTaskId: z.string().min(1, "externalTaskId is required"),
  agent: z.string().min(1, "agent is required"),
  title: z.string().min(1, "title is required"),
  description: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .optional()
    .default(""),
  priority: z.enum(PRIORITY_VALUES).optional().default("medium"),
  status: z.enum(STATUS_VALUES).optional().default("idea_bruta"),
  type: z.enum(TYPE_VALUES).optional().default("feature"),
  tags: stringArray(),
  projectSlug: z.string().optional(),
  metadata: MetadataSchema.optional().default({
    plan: [],
    risks: [],
    validations: [],
    done_when: [],
    score: 0,
    files_to_touch: [],
  }),
});

type ImportPayload = z.infer<typeof ImportPayloadSchema>;

const DEFAULT_PROJECT = {
  id: "2",
  name: "AMON Agents",
  slug: "amon_agents",
  color: "#3b82f6",
  status: "active" as const,
};

async function ensureProjectId(slug: string): Promise<string> {
  const existing = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  if (existing.length > 0) {
    return existing[0].id;
  }

  const id = slug === DEFAULT_PROJECT.slug ? DEFAULT_PROJECT.id : `proj-${slug}`;
  await db
    .insert(projects)
    .values({
      id,
      name: slug === DEFAULT_PROJECT.slug ? DEFAULT_PROJECT.name : slug,
      slug,
      color: DEFAULT_PROJECT.color,
      status: "active",
    })
    .onConflictDoNothing({ target: projects.id });

  return id;
}

function buildInternalTaskId(payload: ImportPayload): string {
  const safeTaskId = payload.externalTaskId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeAgent = payload.agent.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `aa-${safeTaskId}-${safeAgent}`.toLowerCase();
}

function mergeTags(payload: ImportPayload): string[] {
  const seed = ["amon-agents", `agent:${payload.agent}`, `ext:${payload.externalTaskId}`];
  const merged = new Set<string>([...seed, ...payload.tags]);
  return Array.from(merged).filter(Boolean);
}

function buildCodexLoop(payload: ImportPayload): Record<string, unknown> {
  const md = payload.metadata;
  const planText = md.plan?.length ? md.plan.join("\n- ") : undefined;
  const validationText = md.validations?.length ? md.validations.join("\n- ") : undefined;
  const doneText = md.done_when?.length ? md.done_when.join("\n- ") : undefined;
  const filesToTouch = md.files_to_touch?.filter(Boolean) ?? [];
  const extra = md as Record<string, unknown>;

  return {
    problem: payload.description || undefined,
    objective: payload.title,
    plan: md.plan,
    validations: md.validations,
    done_when: md.done_when,
    files_to_touch: filesToTouch,
    state_guardian:
      typeof extra.state_guardian === "string" ? extra.state_guardian : undefined,
    qa_review: typeof extra.qa_review === "string" ? extra.qa_review : undefined,
    scoring_detail:
      typeof extra.scoring_detail === "string" ? extra.scoring_detail : undefined,
    solution: planText ? `- ${planText}` : undefined,
    validation: validationText ? `- ${validationText}` : undefined,
    nextStep: doneText ? `- ${doneText}` : undefined,
  };
}

function buildAgentMetadata(payload: ImportPayload): Record<string, unknown> {
  const extra = payload.metadata as Record<string, unknown>;

  return {
    risks: payload.metadata.risks ?? [],
    files_to_touch: payload.metadata.files_to_touch ?? [],
    state_guardian:
      typeof extra.state_guardian === "string" ? extra.state_guardian : undefined,
    qa_review: typeof extra.qa_review === "string" ? extra.qa_review : undefined,
    scoring_detail:
      typeof extra.scoring_detail === "string" ? extra.scoring_detail : undefined,
    source: payload.source,
    agent: payload.agent,
    externalTaskId: payload.externalTaskId,
  };
}

function buildMoneyCode(payload: ImportPayload): Record<string, unknown> {
  const extra = payload.metadata as Record<string, unknown>;
  return {
    score: payload.metadata.score ?? 0,
    rationale:
      typeof extra.scoring_detail === "string" ? extra.scoring_detail : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const denied = rejectIfUnauthorized(req);
    if (denied) return denied;

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json(
        { ok: false, error: "Invalid or empty JSON body" },
        { status: 400 },
      );
    }

    const parsed = ImportPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.join(".");
      const message = path ? `${path}: ${issue.message}` : issue.message;
      return NextResponse.json(
        { ok: false, error: `Validation failed — ${message}`, issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    const projectSlug = payload.projectSlug?.trim() || DEFAULT_PROJECT.slug;
    const projectId = await ensureProjectId(projectSlug);

    const taskId = buildInternalTaskId(payload);
    const tags = mergeTags(payload);
    const codexLoop = buildCodexLoop(payload);
    const agentMetadata = buildAgentMetadata(payload);
    const moneyCode = buildMoneyCode(payload);
    const description =
      payload.description.trim() ||
      `Tarea importada desde amon-agents (agente=${payload.agent}, ref=${payload.externalTaskId}).`;

    const now = new Date().toISOString();

    await db
      .insert(tasks)
      .values({
        id: taskId,
        title: payload.title,
        description,
        status: payload.status,
        type: payload.type,
        priority: payload.priority,
        tags,
        projectId,
        codexLoop,
        fiveWhys: agentMetadata,
        moneyCode,
      })
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          title: payload.title,
          description,
          status: payload.status,
          type: payload.type,
          priority: payload.priority,
          tags,
          codexLoop,
          fiveWhys: agentMetadata,
          moneyCode,
          updatedAt: now,
        },
      });

    await logDockEvent(
      "system",
      `[amon-agents] import ${payload.agent} → ${payload.externalTaskId} (task=${taskId})`,
    );

    return NextResponse.json({
      ok: true,
      taskId,
      projectId,
      source: payload.source,
      agent: payload.agent,
      externalTaskId: payload.externalTaskId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .insert(events)
      .values({
        id: `ev-${Date.now()}-err`,
        type: "system",
        message: `[amon-agents] import error: ${message}`,
      })
      .catch(() => undefined);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
