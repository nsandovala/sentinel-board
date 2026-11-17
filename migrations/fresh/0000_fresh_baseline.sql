CREATE TABLE "card_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"author" text DEFAULT 'user' NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'comment' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dock_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"project" text,
	"value" text,
	"raw" text NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"result_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text,
	"state" text DEFAULT 'idle' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"elapsed_seconds" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"category" text DEFAULT 'note' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"body" text NOT NULL,
	"source_task_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_entries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"repo_url" text,
	"color" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "suggestion_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"source" text NOT NULL,
	"suggestion_type" text NOT NULL,
	"content" text NOT NULL,
	"decision" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_insights" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"evidence_json" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'idea_bruta' NOT NULL,
	"type" text DEFAULT 'task' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"project_id" text NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"blocker_reason" text,
	"codex_loop" jsonb,
	"five_whys" jsonb,
	"money_code" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_comments" ADD CONSTRAINT "card_comments_card_id_tasks_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_source_task_id_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_comments_card_id_idx" ON "card_comments" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "card_comments_created_at_idx" ON "card_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dock_commands_created_at_idx" ON "dock_commands" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "focus_sessions_state_idx" ON "focus_sessions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "focus_sessions_started_at_idx" ON "focus_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "knowledge_entries_project_id_idx" ON "knowledge_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "knowledge_entries_category_idx" ON "knowledge_entries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "knowledge_entries_status_idx" ON "knowledge_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_entries_updated_at_idx" ON "knowledge_entries" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "knowledge_entries_source_task_id_idx" ON "knowledge_entries" USING btree ("source_task_id");--> statement-breakpoint
CREATE INDEX "knowledge_entries_tags_gin_idx" ON "knowledge_entries" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "suggestion_feedback_project_id_idx" ON "suggestion_feedback" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "suggestion_feedback_task_id_idx" ON "suggestion_feedback" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "suggestion_feedback_decision_idx" ON "suggestion_feedback" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "suggestion_feedback_created_at_idx" ON "suggestion_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "system_insights_project_id_idx" ON "system_insights" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "system_insights_task_id_idx" ON "system_insights" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "system_insights_type_idx" ON "system_insights" USING btree ("type");--> statement-breakpoint
CREATE INDEX "system_insights_status_idx" ON "system_insights" USING btree ("status");--> statement-breakpoint
CREATE INDEX "system_insights_created_at_idx" ON "system_insights" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "task_checklist_task_id_idx" ON "task_checklist_items" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_priority_idx" ON "tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "tasks_type_idx" ON "tasks" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tasks_blocked_idx" ON "tasks" USING btree ("blocked");--> statement-breakpoint
CREATE INDEX "tasks_updated_at_idx" ON "tasks" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "tasks_created_at_idx" ON "tasks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tasks_tags_gin_idx" ON "tasks" USING gin ("tags");