import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── Projects ────────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  repoUrl: text("repo_url"),
  color: text("color"),
  status: text("status", { enum: ["active", "paused", "archived"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Tasks (cards) ───────────────────────────────────────────────────────────

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("idea_bruta"),
  type: text("type").notNull().default("task"),
  priority: text("priority").notNull().default("medium"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
  blockerReason: text("blocker_reason"),
  codexLoop: text("codex_loop", { mode: "json" }).$type<Record<string, string | undefined>>(),
  fiveWhys: text("five_whys", { mode: "json" }).$type<Record<string, string | undefined>>(),
  moneyCode: text("money_code", { mode: "json" }).$type<Record<string, number | undefined>>(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Task checklist items ────────────────────────────────────────────────────

export const taskChecklistItems = sqliteTable("task_checklist_items", {
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

// ── Events (timeline) ───────────────────────────────────────────────────────

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: ["command", "system", "heo_suggestion", "focus"],
  }).notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Dock commands ───────────────────────────────────────────────────────────

export const dockCommands = sqliteTable("dock_commands", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  target: text("target"),
  project: text("project"),
  value: text("value"),
  raw: text("raw").notNull(),
  success: integer("success", { mode: "boolean" }).notNull().default(false),
  resultMessage: text("result_message"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Focus sessions ──────────────────────────────────────────────────────────

export const focusSessions = sqliteTable("focus_sessions", {
  id: text("id").primaryKey(),
  project: text("project"),
  state: text("state", {
    enum: ["idle", "running", "paused", "ended"],
  })
    .notNull()
    .default("idle"),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
});
