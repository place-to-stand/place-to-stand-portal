-- A task now belongs to a project or to a lead, never both. Lead tasks used
-- to live in the internal Sales project as well; they leave it here, and the
-- Sales project keeps only its own tasks. A lead task now goes with its lead
-- (cascade), as a project task goes with its project.
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_lead_id_fkey";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "tasks" SET "project_id" = NULL WHERE "lead_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_or_lead" CHECK (num_nonnulls(project_id, lead_id) = 1);
