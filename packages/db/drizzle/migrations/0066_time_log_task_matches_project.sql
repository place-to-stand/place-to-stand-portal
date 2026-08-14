-- PRD 005 §04 (W23) — version the time-log project-match check, and make it
-- reject lead-anchored tasks.
--
-- WHY THIS EXISTS AS A CUSTOM MIGRATION
-- `time_log_tasks_project_match` is declared in packages/db/src/schema.ts and
-- appears in every drizzle snapshot back to 0003, but it was captured by the
-- Supabase baseline INTROSPECTION and never emitted into a migration. Audit A3
-- confirmed the consequence: `SELECT prosrc FROM pg_proc WHERE proname =
-- 'time_log_task_matches_project'` returns ZERO rows on a database built from
-- the migration chain, and `pg_constraint` on `time_log_tasks` carries only the
-- primary key and two foreign keys. So the constraint exists in production and
-- NOWHERE ELSE — dev, CI, and any fresh environment have no project-match
-- enforcement at all.
--
-- drizzle-kit cannot express a function definition, so this is a `--custom`
-- migration: generated through the CLI (which owns meta/_journal.json), with
-- the body written here. That is the sanctioned path for SQL the differ can't
-- produce; it is not a hand-edit of an auto-generated diff.
--
-- WHAT CHANGED
-- D10 forbids time-logging a lead task. A CHECK constraint PASSES on NULL, so a
-- body that simply compared `tl.project_id = t.project_id` would evaluate to
-- NULL for a lead task (null project_id) and the constraint would silently
-- permit exactly the linkage D10 forbids (C7). The guard below returns FALSE
-- explicitly in that case.

CREATE OR REPLACE FUNCTION public.time_log_task_matches_project(
  p_time_log_id uuid,
  p_task_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.time_logs tl
    JOIN public.tasks t ON t.id = p_task_id
    WHERE tl.id = p_time_log_id
      -- Lead-anchored tasks have no project to match, and are not billable to
      -- one. Returning FALSE (not NULL) is what makes the CHECK actually fire.
      AND t.project_id IS NOT NULL
      AND t.project_id = tl.project_id
  );
$$;
--> statement-breakpoint
-- Idempotent: production already has this constraint from the pre-Drizzle era,
-- while migration-built databases have never had it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'time_log_tasks_project_match'
      AND conrelid = 'public.time_log_tasks'::regclass
  ) THEN
    ALTER TABLE public.time_log_tasks
      ADD CONSTRAINT time_log_tasks_project_match
      CHECK (public.time_log_task_matches_project(time_log_id, task_id));
  END IF;
END
$$;
