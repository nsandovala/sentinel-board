-- SB-QA ONLY. Reviewed package; no execution has occurred.
-- Reconstructed PENDING 0002 from reviewed proposals/schema, not recovered historical bytes.
DO $guard$
BEGIN
  IF current_database() <> 'neondb' OR current_setting('neon.branch_id', true) IS DISTINCT FROM 'br-red-fog-anconkry' THEN
    RAISE EXCEPTION 'STOP: not the authorized SB-QA database/branch';
  END IF;
  IF current_setting('sbqa.package_mode', true) IS DISTINCT FROM 'apply-0002' THEN
    RAISE EXCEPTION 'Use the reviewed transactional wrapper, not this file alone';
  END IF;
END $guard$;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
LOCK TABLE public."card_comments", public."dock_commands", public."events", public."focus_sessions", public."knowledge_entries", public."task_checklist_items", public."tasks" IN SHARE MODE;
DO $preconditions$
DECLARE current_indexes text;
BEGIN
  IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 2
     OR (SELECT count(DISTINCT (hash,created_at)) FROM drizzle.__drizzle_migrations WHERE (hash='85fa980d1f8cf3b34056c1fcdebbd56c15a6ed9f67bac612f39c65fcb98b9a29' AND created_at=1777431274624) OR (hash='378e4864f152f0e06a2a4c7b3a616ebde2b681e8fad28c05664e69af83e2f070' AND created_at=1777441112652)) <> 2 THEN
    RAISE EXCEPTION 'STOP: migration ledger differs from verified 0000/0001';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relname=ANY(ARRAY['suggestion_feedback','system_insights','tasks_project_id_idx','tasks_status_idx','tasks_priority_idx','tasks_type_idx','tasks_blocked_idx','tasks_updated_at_idx','tasks_created_at_idx','tasks_tags_gin_idx','task_checklist_task_id_idx','card_comments_card_id_idx','card_comments_created_at_idx','events_created_at_idx','events_type_idx','dock_commands_created_at_idx','focus_sessions_state_idx','focus_sessions_started_at_idx','knowledge_entries_project_id_idx','knowledge_entries_category_idx','knowledge_entries_status_idx','knowledge_entries_updated_at_idx','knowledge_entries_source_task_id_idx','knowledge_entries_tags_gin_idx','suggestion_feedback_project_id_idx','suggestion_feedback_task_id_idx','suggestion_feedback_decision_idx','suggestion_feedback_created_at_idx','system_insights_project_id_idx','system_insights_task_id_idx','system_insights_type_idx','system_insights_status_idx','system_insights_created_at_idx','suggestion_feedback_pkey','system_insights_pkey'])) THEN
    RAISE EXCEPTION 'STOP: target object already exists; do not overwrite or skip it';
  END IF;
  SELECT md5(string_agg(p.indexname || '|' || p.indexdef || '|' || i.indisvalid::text || '|' || i.indisready::text,
         E'\n' ORDER BY p.tablename,p.indexname)) INTO current_indexes
    FROM pg_indexes p JOIN pg_namespace n ON n.nspname=p.schemaname
    JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=p.indexname
    JOIN pg_index i ON i.indexrelid=c.oid WHERE p.schemaname='public';
  IF current_indexes IS DISTINCT FROM '6d84a751f202bb22d7dff045da928925' THEN
    RAISE EXCEPTION 'STOP: index catalog changed; compare definitions again';
  END IF;
END $preconditions$;

CREATE TABLE public."suggestion_feedback" (
  "id" text NOT NULL PRIMARY KEY,
  "project_id" text NOT NULL,
  "task_id" text,
  "source" text NOT NULL,
  "suggestion_type" text NOT NULL,
  "content" text NOT NULL,
  "decision" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "suggestion_feedback_project_id_idx" ON public."suggestion_feedback" USING btree ("project_id");
CREATE INDEX "suggestion_feedback_task_id_idx" ON public."suggestion_feedback" USING btree ("task_id");
CREATE INDEX "suggestion_feedback_decision_idx" ON public."suggestion_feedback" USING btree ("decision");
CREATE INDEX "suggestion_feedback_created_at_idx" ON public."suggestion_feedback" USING btree ("created_at");

CREATE TABLE public."system_insights" (
  "id" text NOT NULL PRIMARY KEY,
  "project_id" text NOT NULL,
  "task_id" text,
  "type" text NOT NULL,
  "severity" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "evidence_json" jsonb,
  "status" text NOT NULL DEFAULT 'open',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "system_insights_project_id_idx" ON public."system_insights" USING btree ("project_id");
CREATE INDEX "system_insights_task_id_idx" ON public."system_insights" USING btree ("task_id");
CREATE INDEX "system_insights_type_idx" ON public."system_insights" USING btree ("type");
CREATE INDEX "system_insights_status_idx" ON public."system_insights" USING btree ("status");
CREATE INDEX "system_insights_created_at_idx" ON public."system_insights" USING btree ("created_at");

CREATE INDEX "tasks_project_id_idx" ON public."tasks" USING btree ("project_id");
CREATE INDEX "tasks_status_idx" ON public."tasks" USING btree ("status");
CREATE INDEX "tasks_priority_idx" ON public."tasks" USING btree ("priority");
CREATE INDEX "tasks_type_idx" ON public."tasks" USING btree ("type");
CREATE INDEX "tasks_blocked_idx" ON public."tasks" USING btree ("blocked");
CREATE INDEX "tasks_updated_at_idx" ON public."tasks" USING btree ("updated_at");
CREATE INDEX "tasks_created_at_idx" ON public."tasks" USING btree ("created_at");
CREATE INDEX "tasks_tags_gin_idx" ON public."tasks" USING gin ("tags");

CREATE INDEX "task_checklist_task_id_idx" ON public."task_checklist_items" USING btree ("task_id");

CREATE INDEX "card_comments_card_id_idx" ON public."card_comments" USING btree ("card_id");
CREATE INDEX "card_comments_created_at_idx" ON public."card_comments" USING btree ("created_at");

CREATE INDEX "events_created_at_idx" ON public."events" USING btree ("created_at");
CREATE INDEX "events_type_idx" ON public."events" USING btree ("type");

CREATE INDEX "dock_commands_created_at_idx" ON public."dock_commands" USING btree ("created_at");

CREATE INDEX "focus_sessions_state_idx" ON public."focus_sessions" USING btree ("state");
CREATE INDEX "focus_sessions_started_at_idx" ON public."focus_sessions" USING btree ("started_at");

CREATE INDEX "knowledge_entries_project_id_idx" ON public."knowledge_entries" USING btree ("project_id");
CREATE INDEX "knowledge_entries_category_idx" ON public."knowledge_entries" USING btree ("category");
CREATE INDEX "knowledge_entries_status_idx" ON public."knowledge_entries" USING btree ("status");
CREATE INDEX "knowledge_entries_updated_at_idx" ON public."knowledge_entries" USING btree ("updated_at");
CREATE INDEX "knowledge_entries_source_task_id_idx" ON public."knowledge_entries" USING btree ("source_task_id");
CREATE INDEX "knowledge_entries_tags_gin_idx" ON public."knowledge_entries" USING gin ("tags");
