ALTER TABLE "clients" RENAME COLUMN "referred_by" TO "origination_contact_id";--> statement-breakpoint
ALTER TABLE "clients" RENAME CONSTRAINT "clients_referred_by_fkey" TO "clients_origination_contact_id_fkey";--> statement-breakpoint
DROP INDEX "idx_clients_referred_by";--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "origination_user_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "closer_user_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_origination_user_id_fkey" FOREIGN KEY ("origination_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_closer_user_id_fkey" FOREIGN KEY ("closer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clients_origination_contact_id" ON "clients" USING btree ("origination_contact_id" uuid_ops) WHERE (deleted_at IS NULL AND origination_contact_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_clients_origination_user_id" ON "clients" USING btree ("origination_user_id" uuid_ops) WHERE (deleted_at IS NULL AND origination_user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_clients_closer_user_id" ON "clients" USING btree ("closer_user_id" uuid_ops) WHERE (deleted_at IS NULL AND closer_user_id IS NOT NULL);--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_origination_mutex" CHECK (NOT (origination_user_id IS NOT NULL AND origination_contact_id IS NOT NULL));