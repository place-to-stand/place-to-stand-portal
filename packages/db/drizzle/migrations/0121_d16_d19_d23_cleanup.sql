ALTER TABLE "activity_logs" DROP COLUMN "context_route";--> statement-breakpoint
-- D23: the two empty archive tables from the sales tools release.
DROP TABLE IF EXISTS "archive_sales_tools"."contacts_is_champion";--> statement-breakpoint
DROP TABLE IF EXISTS "archive_sales_tools"."unmapped_portal_access";--> statement-breakpoint
-- D19: these triggers already exist on prod but no migration created them.
-- Record them here (same definitions) so a fresh database matches prod.
-- The app does not set updated_at on every update, so they stay.
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
	new.updated_at = timezone('utc', now());
	return new;
end;
$function$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "activity_overview_cache_set_updated_at" ON "activity_overview_cache";--> statement-breakpoint
CREATE TRIGGER "activity_overview_cache_set_updated_at" BEFORE UPDATE ON "activity_overview_cache" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "task_attachments_set_updated_at" ON "task_attachments";--> statement-breakpoint
CREATE TRIGGER "task_attachments_set_updated_at" BEFORE UPDATE ON "task_attachments" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "task_comments_set_updated_at" ON "task_comments";--> statement-breakpoint
CREATE TRIGGER "task_comments_set_updated_at" BEFORE UPDATE ON "task_comments" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "tasks_set_updated_at" ON "tasks";--> statement-breakpoint
CREATE TRIGGER "tasks_set_updated_at" BEFORE UPDATE ON "tasks" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "time_log_tasks_set_updated_at" ON "time_log_tasks";--> statement-breakpoint
CREATE TRIGGER "time_log_tasks_set_updated_at" BEFORE UPDATE ON "time_log_tasks" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "time_logs_set_updated_at" ON "time_logs";--> statement-breakpoint
CREATE TRIGGER "time_logs_set_updated_at" BEFORE UPDATE ON "time_logs" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "users_set_updated_at" ON "users";--> statement-breakpoint
CREATE TRIGGER "users_set_updated_at" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "projects_set_updated_at" ON "projects";--> statement-breakpoint
CREATE TRIGGER "projects_set_updated_at" BEFORE UPDATE ON "projects" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS "hour_blocks_set_updated_at" ON "hour_blocks";--> statement-breakpoint
CREATE TRIGGER "hour_blocks_set_updated_at" BEFORE UPDATE ON "hour_blocks" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
