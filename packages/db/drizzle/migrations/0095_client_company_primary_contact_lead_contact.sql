ALTER TABLE "clients" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "primary_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clients_company" ON "clients" USING btree ("company_id" uuid_ops) WHERE (deleted_at IS NULL AND company_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_leads_contact" ON "leads" USING btree ("contact_id" uuid_ops) WHERE (deleted_at IS NULL AND contact_id IS NOT NULL);