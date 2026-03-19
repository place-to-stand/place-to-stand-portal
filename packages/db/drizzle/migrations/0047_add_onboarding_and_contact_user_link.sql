ALTER TABLE "contacts" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contacts_user_id" ON "contacts" USING btree ("user_id" uuid_ops) WHERE (user_id IS NOT NULL);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_key" UNIQUE("user_id");--> statement-breakpoint
-- Backfill: mark existing CLIENT users as having completed onboarding
-- so they are not forced through the onboarding flow
UPDATE "users" SET "onboarding_completed_at" = "created_at" WHERE "role" = 'CLIENT' AND "deleted_at" IS NULL;