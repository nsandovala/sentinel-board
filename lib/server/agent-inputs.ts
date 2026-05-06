import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, knowledgeEntries, projects, tasks } from "@/lib/db/schema";

const VALID_SOURCES = new Set([
  "manual",
  "amon_agents",
  "shop",
  "terminal",
] as const);

export type AgentInputSource = "manual" | "amon_agents" | "shop" | "terminal";

export interface AgentInputPayload {
  source: AgentInputSource;
  projectSlug: string;
  title: string;
  content: string;
  tags: string[];
}

interface ValidationOk<T> {
  ok: true;
  value: T;
}

interface ValidationError {
  ok: false;
  error: string;
}

type ValidationResult<T> = ValidationOk<T> | ValidationError;

export class ProjectNotFoundError extends Error {
  constructor(projectSlug: string) {
    super(`Project not found for slug "${projectSlug}"`);
    this.name = "ProjectNotFoundError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeRequiredString(
  value: unknown,
  field: string,
): ValidationResult<string> {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return { ok: false, error: `${field} is required` };
  }
  return { ok: true, value: normalized };
}

function normalizeTags(value: unknown): ValidationResult<string[]> {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "tags must be an array of strings" };
  }

  const normalized = value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (normalized.length !== value.length) {
    return { ok: false, error: "tags must contain only non-empty strings" };
  }

  return { ok: true, value: Array.from(new Set(normalized)) };
}

function normalizeSource(value: unknown): ValidationResult<AgentInputSource> {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!VALID_SOURCES.has(normalized as AgentInputSource)) {
    return {
      ok: false,
      error: "source must be one of: manual, amon_agents, shop, terminal",
    };
  }
  return { ok: true, value: normalized as AgentInputSource };
}

function buildId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugifyText(raw: string): string {
  const normalized = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "idea";
}

function buildSummary(content: string): string | null {
  const singleLine = content.replace(/\s+/g, " ").trim();
  if (!singleLine) return null;
  return singleLine.length > 240 ? `${singleLine.slice(0, 237)}...` : singleLine;
}

async function ensureUniqueKnowledgeSlug(baseSlug: string): Promise<string> {
  for (let suffix = 0; suffix < 100; suffix++) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const [existing] = await db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.slug, candidate))
      .limit(1);

    if (!existing) {
      return candidate;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

export function validateAgentInput(
  body: unknown,
): ValidationResult<AgentInputPayload> {
  const record = asRecord(body);
  if (!record) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const source = normalizeSource(record.source);
  if (!source.ok) return source;

  const projectSlug = normalizeRequiredString(record.projectSlug, "projectSlug");
  if (!projectSlug.ok) return projectSlug;

  const title = normalizeRequiredString(record.title, "title");
  if (!title.ok) return title;

  const content = normalizeRequiredString(record.content, "content");
  if (!content.ok) return content;

  const tags = normalizeTags(record.tags);
  if (!tags.ok) return tags;

  return {
    ok: true,
    value: {
      source: source.value,
      projectSlug: projectSlug.value,
      title: title.value,
      content: content.value,
      tags: tags.value,
    },
  };
}

export interface AgentInputCreateResult {
  projectId: string;
  taskId: string;
  knowledgeEntryId: string;
  eventId: string;
}

export async function createAgentInput(
  payload: AgentInputPayload,
): Promise<AgentInputCreateResult> {
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
    })
    .from(projects)
    .where(eq(projects.slug, payload.projectSlug))
    .limit(1);

  if (!project) {
    throw new ProjectNotFoundError(payload.projectSlug);
  }

  const taskId = buildId("task");
  const knowledgeEntryId = buildId("kn");
  const eventId = buildId("ev");
  const taskTitle = payload.title.slice(0, 200);
  const taskDescription = payload.content;
  const taskTags = Array.from(
    new Set(["agent-input", payload.source, ...payload.tags]),
  );
  const knowledgeSlug = await ensureUniqueKnowledgeSlug(
    slugifyText(`${project.slug}-${taskTitle}`),
  );
  const knowledgeSummary = buildSummary(payload.content);
  const eventMessage = `Idea capturada desde ${payload.source} en ${project.name}: "${taskTitle}"`;

  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id: taskId,
      title: taskTitle,
      description: taskDescription,
      status: "idea_bruta",
      type: "task",
      priority: "medium",
      tags: taskTags,
      projectId: project.id,
      blocked: false,
    });

    await tx.insert(knowledgeEntries).values({
      id: knowledgeEntryId,
      projectId: project.id,
      title: taskTitle,
      slug: knowledgeSlug,
      category: "note",
      status: "published",
      tags: taskTags,
      summary: knowledgeSummary,
      body: payload.content,
      sourceTaskId: taskId,
    });

    await tx.insert(events).values({
      id: eventId,
      type: "system",
      message: eventMessage,
    });
  });

  return {
    projectId: project.id,
    taskId,
    knowledgeEntryId,
    eventId,
  };
}
