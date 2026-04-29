import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ── Tasks (cards) ───────────────────────────────────────────────────────────

export const tasks = pgTable("tasks", {
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ── Task checklist items ────────────────────────────────────────────────────

export const taskChecklistItems = pgTable("task_checklist_items", {
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
});

// ── Card comments ──────────────────────────────────────────────────────────

export const cardComments = pgTable("card_comments", {
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ── Events (timeline) ───────────────────────────────────────────────────────

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: ["command", "system", "heo_suggestion", "focus"],
  }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ── Dock commands ───────────────────────────────────────────────────────────

export const dockCommands = pgTable("dock_commands", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  target: text("target"),
  project: text("project"),
  value: text("value"),
  raw: text("raw").notNull(),
  success: boolean("success").notNull().default(false),
  resultMessage: text("result_message"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ── Focus sessions ──────────────────────────────────────────────────────────

export const focusSessions = pgTable("focus_sessions", {
  id: text("id").primaryKey(),
  project: text("project"),
  state: text("state", {
    enum: ["idle", "running", "paused", "ended"],
  })
    .notNull()
    .default("idle"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
  elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
});

// ── Knowledge entries ───────────────────────────────────────────────────────

export const knowledgeEntries = pgTable("knowledge_entries", {
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});
