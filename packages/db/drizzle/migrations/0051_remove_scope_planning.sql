DROP TABLE "scope_planning_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "plan_threads" DROP CONSTRAINT IF EXISTS "plan_threads_session_xor_scope";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_plan_threads_scope_session";--> statement-breakpoint
DELETE FROM "plan_threads" WHERE "session_id" IS NULL;--> statement-breakpoint
ALTER TABLE "plan_threads" ALTER COLUMN "session_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_threads" DROP COLUMN IF EXISTS "scope_session_id";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."scope_planning_session_status";