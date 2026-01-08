-- =============================================================================
-- 0012_db_review_fixes.sql
-- Database review fixes:
--   1. Add missing partial index on tasks.due_on for calendar queries
--   2. Remove pointless self-referential foreign key on users table
--   3. Remove unused PR suggestion columns (will be redesigned in future sprint)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Add partial index on tasks.due_on for calendar queries
-- This improves performance for date-range lookups in calendar views
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_tasks_due_on"
ON "tasks" USING btree ("due_on" ASC NULLS LAST)
WHERE (deleted_at IS NULL AND due_on IS NOT NULL);--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Step 2: Remove self-referential foreign key on users table
-- This FK (users.id -> users.id) serves no semantic purpose and was likely
-- auto-generated during initial schema introspection
-- -----------------------------------------------------------------------------

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_id_fkey";--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Step 3: Remove unused PR suggestion columns from suggestions table
-- These columns were write-only (never displayed in UI) and the PR suggestion
-- feature will be redesigned to be task-based in a future sprint
-- -----------------------------------------------------------------------------

-- Drop check constraint that referenced github_repo_link_id
ALTER TABLE "suggestions" DROP CONSTRAINT IF EXISTS "suggestions_pr_requires_repo";--> statement-breakpoint

-- Drop index that referenced github_repo_link_id
DROP INDEX IF EXISTS "idx_suggestions_repo";--> statement-breakpoint

-- Drop foreign key constraint
ALTER TABLE "suggestions" DROP CONSTRAINT IF EXISTS "suggestions_github_repo_link_id_fkey";--> statement-breakpoint

-- Drop the columns
ALTER TABLE "suggestions" DROP COLUMN IF EXISTS "github_repo_link_id";--> statement-breakpoint
ALTER TABLE "suggestions" DROP COLUMN IF EXISTS "review_notes";--> statement-breakpoint
ALTER TABLE "suggestions" DROP COLUMN IF EXISTS "created_pr_number";--> statement-breakpoint
ALTER TABLE "suggestions" DROP COLUMN IF EXISTS "created_pr_url";
