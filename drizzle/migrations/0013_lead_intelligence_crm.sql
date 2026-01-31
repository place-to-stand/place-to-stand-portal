ALTER TABLE "leads" ADD COLUMN "overall_score" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "priority_tier" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "signals" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_scored_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_contact_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "awaiting_reply" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "predicted_close_probability" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "estimated_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "expected_close_date" date;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "converted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "converted_to_client_id" uuid;--> statement-breakpoint
ALTER TABLE "suggestions" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_to_client_id_fkey" FOREIGN KEY ("converted_to_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_leads_priority" ON "leads" USING btree ("priority_tier","overall_score" DESC NULLS FIRST) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_suggestions_lead" ON "suggestions" USING btree ("lead_id" uuid_ops) WHERE (deleted_at IS NULL AND lead_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_threads_lead" ON "threads" USING btree ("lead_id" uuid_ops) WHERE (deleted_at IS NULL AND lead_id IS NOT NULL);