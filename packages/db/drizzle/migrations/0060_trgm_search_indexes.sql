CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "idx_clients_name_trgm" ON "clients" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_clients_slug_trgm" ON "clients" USING gin ("slug" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_name_trgm" ON "contacts" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_email_trgm" ON "contacts" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_projects_name_trgm" ON "projects" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_projects_slug_trgm" ON "projects" USING gin ("slug" gin_trgm_ops);