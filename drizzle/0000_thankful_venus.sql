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
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;