-- Audit DB-1: this function and check already exist on prod, but no
-- migration created them, so a fresh database had neither. Record them here
-- (same definitions as prod). The check is re-added NOT VALID: prod holds
-- links whose task or time log was archived later, which the function counts
-- as a mismatch. New and edited links are still checked.
CREATE OR REPLACE FUNCTION public.time_log_task_matches_project(p_time_log_id uuid, p_task_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.time_logs tl
    join public.tasks t on t.id = p_task_id
    where tl.id = p_time_log_id
      and tl.project_id = t.project_id
      and tl.deleted_at is null
      and t.deleted_at is null
  );
$function$;--> statement-breakpoint
ALTER TABLE "time_log_tasks" DROP CONSTRAINT IF EXISTS "time_log_tasks_project_match";--> statement-breakpoint
ALTER TABLE "time_log_tasks" ADD CONSTRAINT "time_log_tasks_project_match" CHECK (public.time_log_task_matches_project(time_log_id, task_id)) NOT VALID;
