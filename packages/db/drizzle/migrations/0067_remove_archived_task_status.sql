-- Legacy status-ARCHIVED rows must move to the real archive mechanism
-- (deleted_at) before the enum loses the value; the final cast below
-- would otherwise fail on them.
UPDATE "tasks"
SET "deleted_at" = COALESCE("deleted_at", now()),
    "status" = 'ON_DECK'
WHERE "status" = 'ARCHIVED';--> statement-breakpoint
-- idx_tasks_completed_at's predicate compares status to a task_status
-- literal, which blocks the text conversion; recreated after the swap.
DROP INDEX "idx_tasks_completed_at";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'ON_DECK'::text;--> statement-breakpoint
DROP TYPE "public"."task_status";--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('ON_DECK', 'IN_PROGRESS', 'BLOCKED', 'DONE');--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'ON_DECK'::"public"."task_status";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DATA TYPE "public"."task_status" USING "status"::"public"."task_status";--> statement-breakpoint
CREATE INDEX "idx_tasks_completed_at" ON "tasks" USING btree ("completed_at" timestamptz_ops) WHERE (deleted_at IS NULL AND status = 'DONE'::task_status);