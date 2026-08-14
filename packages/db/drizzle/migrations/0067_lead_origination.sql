ALTER TABLE "leads" ADD COLUMN "origination_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "origination_user_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_origination_contact_id_fkey" FOREIGN KEY ("origination_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_origination_user_id_fkey" FOREIGN KEY ("origination_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_leads_origination_contact_id" ON "leads" USING btree ("origination_contact_id" uuid_ops) WHERE (deleted_at IS NULL AND origination_contact_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_leads_origination_user_id" ON "leads" USING btree ("origination_user_id" uuid_ops) WHERE (deleted_at IS NULL AND origination_user_id IS NOT NULL);--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_origination_mutex" CHECK (NOT (origination_user_id IS NOT NULL AND origination_contact_id IS NOT NULL));