ALTER TABLE "tasks" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tasks_lead" ON "tasks" USING btree ("lead_id" uuid_ops) WHERE (deleted_at IS NULL AND lead_id IS NOT NULL);