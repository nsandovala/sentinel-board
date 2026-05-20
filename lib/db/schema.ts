import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ── Projects ────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  repoUrl: text("repo_url"),
  color: text("color"),
  status: text("status", { enum: ["active", "paused", "archived"] })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Tasks (cards) ───────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("idea_bruta"),
    type: text("type").notNull().default("task"),
    priority: text("priority").notNull().default("medium"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    blocked: boolean("blocked").notNull().default(false),
    blockerReason: text("blocker_reason"),
    codexLoop: jsonb("codex_loop").$type<Record<string, string | undefined>>(),
    fiveWhys: jsonb("five_whys").$type<Record<string, string | undefined>>(),
    moneyCode: jsonb("money_code").$type<Record<string, number | undefined>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Filters from GET /api/tasks and /api/search.
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_status_idx").on(table.status),
    index("tasks_priority_idx").on(table.priority),
    index("tasks_type_idx").on(table.type),
    index("tasks_blocked_idx").on(table.blocked),
    // Default ORDER BY in /api/tasks and /api/search — Postgres can scan
    // a plain btree in either direction, so no DESC needed.
    index("tasks_updated_at_idx").on(table.updatedAt),
    index("tasks_created_at_idx").on(table.createdAt),
    // jsonb containment: WHERE tags @> '["frontend"]'::jsonb
    index("tasks_tags_gin_idx").using("gin", table.tags),
  ],
);

// ── Task checklist items ────────────────────────────────────────────────────

export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    status: text("status", {
      enum: ["pending", "in_progress", "review", "blocked", "done"],
    })
      .notNull()
      .default("pending"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    // FK does not auto-index in Postgres; this powers cascade lookups,
    // checklist hydration in /api/tasks, and replaceChecklist().
    index("task_checklist_task_id_idx").on(table.taskId),
  ],
);

// ── Card comments ──────────────────────────────────────────────────────────

export const cardComments = pgTable(
  "card_comments",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    author: text("author").notNull().default("user"),
    body: text("body").notNull(),
    type: text("type", {
      enum: ["comment", "decision", "system", "agent"],
    })
      .notNull()
      .default("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // GET /api/tasks/:id/comments: WHERE cardId = ? ORDER BY createdAt
    index("card_comments_card_id_idx").on(table.cardId),
    index("card_comments_created_at_idx").on(table.createdAt),
  ],
);

// ── Events (timeline) ───────────────────────────────────────────────────────

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    type: text("type", {
      enum: ["command", "system", "heo_suggestion", "focus"],
    }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Timeline reads (and /api/root-cause) order by createdAt desc.
    index("events_created_at_idx").on(table.createdAt),
    index("events_type_idx").on(table.type),
  ],
);

// ── Dock commands ───────────────────────────────────────────────────────────

export const dockCommands = pgTable(
  "dock_commands",
  {
    id: text("id").primaryKey(),
    action: text("action").notNull(),
    target: text("target"),
    project: text("project"),
    value: text("value"),
    raw: text("raw").notNull(),
    success: boolean("success").notNull().default(false),
    resultMessage: text("result_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("dock_commands_created_at_idx").on(table.createdAt),
  ],
);

// ── Focus sessions ──────────────────────────────────────────────────────────

export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: text("id").primaryKey(),
    project: text("project"),
    state: text("state", {
      enum: ["idle", "running", "paused", "ended"],
    })
      .notNull()
      .default("idle"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
  },
  (table) => [
    // /api/focus-sessions filters by state=running and orders by startedAt.
    index("focus_sessions_state_idx").on(table.state),
    index("focus_sessions_started_at_idx").on(table.startedAt),
  ],
);

// ── Knowledge entries ───────────────────────────────────────────────────────

export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    category: text("category", {
      enum: ["report", "decision", "runbook", "note", "postmortem"],
    })
      .notNull()
      .default("note"),
    status: text("status", {
      enum: ["draft", "published", "archived"],
    })
      .notNull()
      .default("published"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    summary: text("summary"),
    body: text("body").notNull(),
    sourceTaskId: text("source_task_id").references(() => tasks.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("knowledge_entries_project_id_idx").on(table.projectId),
    index("knowledge_entries_category_idx").on(table.category),
    index("knowledge_entries_status_idx").on(table.status),
    index("knowledge_entries_updated_at_idx").on(table.updatedAt),
    index("knowledge_entries_source_task_id_idx").on(table.sourceTaskId),
    index("knowledge_entries_tags_gin_idx").using("gin", table.tags),
  ],
);

// ── Suggestion feedback ─────────────────────────────────────────────────────

export const suggestionFeedback = pgTable(
  "suggestion_feedback",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    taskId: text("task_id"),
    source: text("source").notNull(),
    suggestionType: text("suggestion_type").notNull(),
    content: text("content").notNull(),
    decision: text("decision", {
      enum: ["accepted", "rejected", "ignored"],
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("suggestion_feedback_project_id_idx").on(table.projectId),
    index("suggestion_feedback_task_id_idx").on(table.taskId),
    index("suggestion_feedback_decision_idx").on(table.decision),
    index("suggestion_feedback_created_at_idx").on(table.createdAt),
  ],
);

// ── System insights ─────────────────────────────────────────────────────────

export const systemInsights = pgTable(
  "system_insights",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    taskId: text("task_id"),
    type: text("type").notNull(),
    severity: text("severity", {
      enum: ["low", "medium", "high", "critical"],
    }).notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    evidenceJson: jsonb("evidence_json"),
    status: text("status", {
      enum: ["open", "dismissed", "resolved"],
    }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("system_insights_project_id_idx").on(table.projectId),
    index("system_insights_task_id_idx").on(table.taskId),
    index("system_insights_type_idx").on(table.type),
    index("system_insights_status_idx").on(table.status),
    index("system_insights_created_at_idx").on(table.createdAt),
  ],
);
