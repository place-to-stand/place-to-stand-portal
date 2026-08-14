ALTER TABLE "tasks" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_anchor_present" CHECK (project_id IS NOT NULL OR lead_id IS NOT NULL);