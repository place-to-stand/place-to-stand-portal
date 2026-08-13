ALTER TABLE "tasks" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
-- Backfill: the best evidence we have for when an existing DONE task finished
-- is its last write. Approximate for tasks edited after completion, but it is
-- a one-time seed — every transition from here on is stamped precisely.
UPDATE "tasks" SET "completed_at" = "updated_at" WHERE "status" = 'DONE' AND "completed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tasks_completed_at" ON "tasks" USING btree ("completed_at" timestamptz_ops) WHERE (deleted_at IS NULL AND status = 'DONE'::task_status);