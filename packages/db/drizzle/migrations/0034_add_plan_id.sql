-- Step 1: Add column as nullable
ALTER TABLE "task_deployments" ADD COLUMN "plan_id" text;--> statement-breakpoint

-- Step 2: Backfill existing rows with generated plan IDs (PLN- + 6-char random)
UPDATE "task_deployments"
SET "plan_id" = 'PLN-' || substr(md5(random()::text), 1, 6)
WHERE "plan_id" IS NULL;--> statement-breakpoint

-- Step 3: Set NOT NULL constraint
ALTER TABLE "task_deployments" ALTER COLUMN "plan_id" SET NOT NULL;--> statement-breakpoint

-- Step 4: Create unique index
CREATE UNIQUE INDEX "idx_task_deployments_plan_id" ON "task_deployments" USING btree ("plan_id" text_ops);
