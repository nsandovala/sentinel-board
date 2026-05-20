import { z } from "zod";

// Mirror types/enums.ts. Kept inline so a runtime change in one source of truth
// fails fast at validation rather than silently passing through.

export const cardStatusEnum = z.enum([
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

export const cardTypeEnum = z.enum([
  "idea",
  "feature",
  "bug",
  "task",
  "decision",
  "experiment",
  "deploy",
  "research",
]);

export const priorityEnum = z.enum(["low", "medium", "high", "critical"]);

export const checklistItemStatusEnum = z.enum([
  "pending",
  "in_progress",
  "review",
  "blocked",
  "done",
]);

export const commentTypeEnum = z.enum(["comment", "decision", "system", "agent"]);

export const moneyClassificationEnum = z.enum([
  "core",
  "quick_win",
  "apuesta",
  "ruido",
]);

const checklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
  status: checklistItemStatusEnum,
});

const codexLoopSchema = z
  .object({
    problem: z.string().max(4000).optional(),
    objective: z.string().max(4000).optional(),
    hypothesis: z.string().max(4000).optional(),
    solution: z.string().max(4000).optional(),
    validation: z.string().max(4000).optional(),
    nextStep: z.string().max(4000).optional(),
  })
  .strict();

const fiveWhysSchema = z
  .object({
    why1: z.string().max(2000).optional(),
    why2: z.string().max(2000).optional(),
    why3: z.string().max(2000).optional(),
    why4: z.string().max(2000).optional(),
    why5: z.string().max(2000).optional(),
    rootCause: z.string().max(4000).optional(),
  })
  .strict();

const moneyCodeSchema = z
  .object({
    revenue: z.number().finite(),
    savings: z.number().finite(),
    automation: z.number().finite(),
    reuse: z.number().finite(),
    validation: z.number().finite(),
    execution: z.number().finite(),
    score: z.number().finite(),
    classification: moneyClassificationEnum,
    rationale: z.string().max(4000),
    impact: z.number().finite().optional(),
    urgency: z.number().finite().optional(),
    effort: z.number().finite().optional(),
    returnValue: z.number().finite().optional(),
    strategyAlignment: z.number().finite().optional(),
    reuseValue: z.number().finite().optional(),
    validationValue: z.number().finite().optional(),
  })
  .strict();

export const patchTaskBodySchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(20_000).nullable().optional(),
    status: cardStatusEnum.optional(),
    type: cardTypeEnum.optional(),
    priority: priorityEnum.optional(),
    tags: z.array(z.string().min(1).max(80)).max(50).optional(),
    blocked: z.boolean().optional(),
    blockerReason: z.string().max(2000).nullable().optional(),
    checklist: z.array(checklistItemSchema).max(200).optional(),
    codexLoop: codexLoopSchema.nullable().optional(),
    fiveWhys: fiveWhysSchema.nullable().optional(),
    moneyCode: moneyCodeSchema.nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type PatchTaskBody = z.infer<typeof patchTaskBodySchema>;

export const postCommentBodySchema = z
  .object({
    id: z.string().min(1).max(200).optional(),
    author: z.string().min(1).max(200).optional(),
    body: z.string().max(20_000).optional(),
    content: z.string().max(20_000).optional(),
    text: z.string().max(20_000).optional(),
    type: commentTypeEnum.optional(),
  })
  .refine(
    (data) =>
      (data.body && data.body.trim().length > 0) ||
      (data.content && data.content.trim().length > 0) ||
      (data.text && data.text.trim().length > 0),
    { message: "body, content or text is required" },
  );

export type PostCommentBody = z.infer<typeof postCommentBodySchema>;

export function extractCommentBody(input: PostCommentBody): string {
  return (input.body ?? input.content ?? input.text ?? "").trim();
}

export const postTaskBodySchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(500),
    projectId: z.string().min(1).max(200),
    description: z.string().max(20_000).nullable().optional(),
    status: cardStatusEnum.optional(),
    type: cardTypeEnum.optional(),
    priority: priorityEnum.optional(),
    tags: z.array(z.string().min(1).max(80)).max(50).optional(),
    blocked: z.boolean().optional(),
    blockerReason: z.string().max(2000).nullable().optional(),
    checklist: z.array(checklistItemSchema).max(200).optional(),
    codexLoop: codexLoopSchema.nullable().optional(),
    fiveWhys: fiveWhysSchema.nullable().optional(),
    moneyCode: moneyCodeSchema.nullable().optional(),
  })
  .strict();

export type PostTaskBody = z.infer<typeof postTaskBodySchema>;

export function flattenZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

// ── GET /api/tasks query params ────────────────────────────────────────────
// Express boolean coercion that tolerates the strings the frontend may send
// (true/false/1/0) and rejects anything else.
const booleanQuery = z
  .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
  .transform((v) => v === "true" || v === "1");

const intQuery = (min: number, max: number, fallback: number) =>
  z
    .string()
    .regex(/^\d+$/, "must be a non-negative integer")
    .transform((s) => Number.parseInt(s, 10))
    .pipe(z.number().int().min(min).max(max))
    .or(z.undefined())
    .transform((n) => (n === undefined ? fallback : n));

export const getTasksQuerySchema = z
  .object({
    q: z.string().min(1).max(200).optional(),
    projectId: z.string().min(1).max(200).optional(),
    status: cardStatusEnum.optional(),
    priority: priorityEnum.optional(),
    type: cardTypeEnum.optional(),
    tag: z.string().min(1).max(80).optional(),
    blocked: booleanQuery.optional(),
    limit: intQuery(1, 200, 200),
    offset: intQuery(0, 100_000, 0),
  })
  .strict();

export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>;

// Escape Postgres ILIKE wildcards so user input like "50%" does not match
// every row that contains "50".
export function escapeLikePattern(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
