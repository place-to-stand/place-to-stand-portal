-- D21: the schema declared a view the database never had.
DROP VIEW IF EXISTS "public"."current_user_with_role";--> statement-breakpoint
-- D17: seven indexes another index already covers (same leading columns).
-- Dropping an index loses no data; recreate from 0117's schema to undo.
DROP INDEX IF EXISTS "idx_billing_terms_resolution";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_commission_terms_resolution";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_role_terms_resolution";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_contacts_email";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_contacts_user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_plan_revisions_thread";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_time_logs_project";--> statement-breakpoint
-- D18: indexes for a company's activity feed and for actor lookups.
-- drizzle-kit leaves DESC out when an index column also names an operator
-- class, so the sort order is written here by hand to match the schema.
CREATE INDEX "idx_activity_logs_company" ON "activity_logs" USING btree ("target_company_id" uuid_ops,"created_at" timestamptz_ops DESC);--> statement-breakpoint
CREATE INDEX "idx_activity_logs_actor" ON "activity_logs" USING btree ("actor_id" uuid_ops);--> statement-breakpoint
-- D18: two indexes the schema declares newest-first were built oldest-first
-- (same drizzle-kit gap). Rebuild them as declared.
DROP INDEX IF EXISTS "idx_activity_logs_type_created_at";--> statement-breakpoint
CREATE INDEX "idx_activity_logs_type_created_at" ON "activity_logs" USING btree ("target_type" text_ops,"created_at" timestamptz_ops DESC);--> statement-breakpoint
DROP INDEX IF EXISTS "idx_activity_logs_project";--> statement-breakpoint
CREATE INDEX "idx_activity_logs_project" ON "activity_logs" USING btree ("target_project_id" uuid_ops,"created_at" timestamptz_ops DESC);
