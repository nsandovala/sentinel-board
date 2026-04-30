import type { SentinelCard } from "@/types/card";
import type { CardStatus, CardType, PriorityLevel } from "@/types/enums";

const VALID_STATUSES: Set<CardStatus> = new Set([
  "idea_bruta",
  "clarificando",
  "validando",
  "en_proceso",
  "desarrollo",
  "qa",
  "listo",
  "produccion",
  "archivado",
]);

const VALID_TYPES: Set<CardType> = new Set([
  "idea",
  "feature",
  "bug",
  "task",
  "decision",
  "experiment",
  "deploy",
  "research",
]);

const VALID_PRIORITIES: Set<PriorityLevel> = new Set([
  "low",
  "medium",
  "high",
  "critical",
]);

const VALID_CHECKLIST_STATUSES = new Set([
  "pending",
  "in_progress",
  "review",
  "blocked",
  "done",
]);

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface NormalizedTaskCreate {
  id: string;
  title: string;
  description: string | null;
  status: CardStatus;
  type: CardType;
  priority: PriorityLevel;
  tags: string[];
  projectId: string;
  blocked: boolean;
  blockerReason: string | null;
  codexLoop: Record<string, string | undefined> | null;
  fiveWhys: Record<string, string | undefined> | null;
  moneyCode: Record<string, number | undefined> | null;
  checklist: SentinelCard["checklist"];
}

export interface NormalizedTaskPatch {
  title?: string;
  description?: string | null;
  status?: CardStatus;
  type?: CardType;
  priority?: PriorityLevel;
  tags?: string[];
  blocked?: boolean;
  blockerReason?: string | null;
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

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeEnum<T extends string>(
  value: unknown,
  validValues: Set<T>,
  field: string,
  fallback?: T,
): ValidationResult<T> {
  if (value === undefined && fallback) {
    return { ok: true, value: fallback };
  }

  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || !validValues.has(normalized as T)) {
    return { ok: false, error: `Invalid ${field}` };
  }

  return { ok: true, value: normalized as T };
}

function normalizeTags(value: unknown): ValidationResult<string[]> {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "tags must be an array of strings" };
  }

  const stringsOnly = value.filter((tag): tag is string => typeof tag === "string");
  if (stringsOnly.length !== value.length) {
    return { ok: false, error: "tags must contain only strings" };
  }

  return {
    ok: true,
    value: Array.from(new Set(stringsOnly.map((tag) => tag.trim()).filter(Boolean))),
  };
}

function normalizeChecklist(
  value: unknown,
): ValidationResult<SentinelCard["checklist"]> {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "checklist must be an array" };
  }

  const normalized: SentinelCard["checklist"] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) {
      return { ok: false, error: "checklist items must be objects" };
    }

    const id = normalizeRequiredString(record.id, "checklist item id");
    if (!id.ok) return id;

    const text = normalizeRequiredString(record.text, "checklist item text");
    if (!text.ok) return text;

    const status = normalizeEnum(
      record.status,
      VALID_CHECKLIST_STATUSES,
      "checklist item status",
      "pending",
    );
    if (!status.ok) return status;

    normalized.push({
      id: id.value,
      text: text.value,
      status: status.value as "pending" | "in_progress" | "review" | "blocked" | "done",
    });
  }

  return { ok: true, value: normalized };
}

function normalizeStringMap(value: unknown): Record<string, string | undefined> | null {
  const record = asRecord(value);
  if (!record) return null;

  const normalized: Record<string, string | undefined> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (raw === undefined || raw === null) {
      normalized[key] = undefined;
    } else if (typeof raw === "string") {
      normalized[key] = raw.trim() || undefined;
    }
  }
  return normalized;
}

function normalizeNumberMap(value: unknown): Record<string, number | undefined> | null {
  const record = asRecord(value);
  if (!record) return null;

  const normalized: Record<string, number | undefined> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (raw === undefined || raw === null) {
      normalized[key] = undefined;
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      normalized[key] = raw;
    }
  }
  return normalized;
}

export function validateTaskCreate(
  body: Partial<SentinelCard>,
): ValidationResult<NormalizedTaskCreate> {
  const id = normalizeRequiredString(body.id, "id");
  if (!id.ok) return id;

  const title = normalizeRequiredString(body.title, "title");
  if (!title.ok) return title;

  const projectId = normalizeRequiredString(body.projectId, "projectId");
  if (!projectId.ok) return projectId;

  const status = normalizeEnum(body.status, VALID_STATUSES, "status", "idea_bruta");
  if (!status.ok) return status;

  const type = normalizeEnum(body.type, VALID_TYPES, "type", "task");
  if (!type.ok) return type;

  const priority = normalizeEnum(
    body.priority,
    VALID_PRIORITIES,
    "priority",
    "medium",
  );
  if (!priority.ok) return priority;

  const tags = normalizeTags(body.tags);
  if (!tags.ok) return tags;

  const checklist = normalizeChecklist(body.checklist);
  if (!checklist.ok) return checklist;

  return {
    ok: true,
    value: {
      id: id.value,
      title: title.value,
      description: normalizeOptionalString(body.description),
      status: status.value,
      type: type.value,
      priority: priority.value,
      tags: tags.value,
      projectId: projectId.value,
      blocked: Boolean(body.blocked),
      blockerReason: normalizeOptionalString(body.blockerReason),
      codexLoop: normalizeStringMap(body.codexLoop),
      fiveWhys: normalizeStringMap(body.fiveWhys),
      moneyCode: normalizeNumberMap(body.moneyCode),
      checklist: checklist.value,
    },
  };
}

export function validateTaskPatch(
  body: Record<string, unknown>,
): ValidationResult<NormalizedTaskPatch> {
  const updates: NormalizedTaskPatch = {};

  if (body.status !== undefined) {
    const status = normalizeEnum(body.status, VALID_STATUSES, "status");
    if (!status.ok) return status;
    updates.status = status.value;
  }

  if (body.title !== undefined) {
    const title = normalizeRequiredString(body.title, "title");
    if (!title.ok) return title;
    updates.title = title.value;
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      return { ok: false, error: "description must be a string or null" };
    }
    updates.description = normalizeOptionalString(body.description);
  }

  if (body.priority !== undefined) {
    const priority = normalizeEnum(body.priority, VALID_PRIORITIES, "priority");
    if (!priority.ok) return priority;
    updates.priority = priority.value;
  }

  if (body.type !== undefined) {
    const type = normalizeEnum(body.type, VALID_TYPES, "type");
    if (!type.ok) return type;
    updates.type = type.value;
  }

  if (body.tags !== undefined) {
    const tags = normalizeTags(body.tags);
    if (!tags.ok) return tags;
    updates.tags = tags.value;
  }

  if (body.blocked !== undefined) {
    if (typeof body.blocked !== "boolean") {
      return { ok: false, error: "blocked must be a boolean" };
    }
    updates.blocked = body.blocked;
  }

  if (body.blockerReason !== undefined) {
    if (body.blockerReason !== null && typeof body.blockerReason !== "string") {
      return { ok: false, error: "blockerReason must be a string or null" };
    }
    updates.blockerReason = normalizeOptionalString(body.blockerReason);
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "No valid fields to update" };
  }

  return { ok: true, value: updates };
}
