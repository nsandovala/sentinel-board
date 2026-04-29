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
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_source_task_id_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;