-- Migrate existing tasks off the BACKLOG and IN_REVIEW statuses, then drop
-- those values from the task_status enum.
--
-- Postgres does not support removing values from an enum in place, so we
-- recreate the type and cast the column. The default must be dropped first
-- since the cast would otherwise fail to match the new type.

-- Step 1: Backfill existing rows to the surviving statuses.
UPDATE "tasks" SET "status" = 'ON_DECK' WHERE "status" = 'BACKLOG';--> statement-breakpoint
UPDATE "tasks" SET "status" = 'IN_PROGRESS' WHERE "status" = 'IN_REVIEW';--> statement-breakpoint

-- Step 2: Drop the column default before swapping the enum type.
ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint

-- Step 3: Rename the old enum out of the way and create the new one.
ALTER TYPE "public"."task_status" RENAME TO "task_status_old";--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('ON_DECK', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'ARCHIVED');--> statement-breakpoint

-- Step 4: Cast the column to the new enum type via text.
ALTER TABLE "tasks"
  ALTER COLUMN "status" TYPE "public"."task_status"
  USING "status"::text::"public"."task_status";--> statement-breakpoint

-- Step 5: Restore the default (now ON_DECK instead of BACKLOG) and drop the old enum.
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'ON_DECK';--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
DROP TYPE "public"."task_status_old";
