CREATE TABLE "client_commission_term_closers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"closer_user_id" uuid,
	"closer_contact_id" uuid,
	"share_percent" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_client_commission_term_closers_one_party" CHECK ((closer_user_id IS NULL) <> (closer_contact_id IS NULL)),
	CONSTRAINT "chk_client_commission_term_closers_share" CHECK (share_percent > 0 AND share_percent <= 100)
);
--> statement-breakpoint
ALTER TABLE "client_commission_term_closers" ADD CONSTRAINT "client_commission_term_closers_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "public"."client_commission_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_commission_term_closers" ADD CONSTRAINT "client_commission_term_closers_closer_user_id_fkey" FOREIGN KEY ("closer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_commission_term_closers" ADD CONSTRAINT "client_commission_term_closers_closer_contact_id_fkey" FOREIGN KEY ("closer_contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_commission_term_closers_term" ON "client_commission_term_closers" USING btree ("term_id") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_client_commission_term_closers_user" ON "client_commission_term_closers" USING btree ("term_id","closer_user_id") WHERE (deleted_at IS NULL AND closer_user_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_client_commission_term_closers_contact" ON "client_commission_term_closers" USING btree ("term_id","closer_contact_id") WHERE (deleted_at IS NULL AND closer_contact_id IS NOT NULL);--> statement-breakpoint
-- Backfill: every term's single closer becomes one closer row at 100%, so
-- each historical month resolves to exactly the payout it was closed with.
-- Soft-deleted terms are copied too (their rows simply never resolve).
-- The old closer_user_id columns stay (unused) so this migration can run
-- ahead of the deploy with no downtime; a follow-up drops them, re-running
-- this backfill first for any term written by the old code in between.
INSERT INTO "client_commission_term_closers" ("term_id", "closer_user_id", "share_percent", "created_at", "updated_at")
SELECT "id", "closer_user_id", 100, "created_at", "updated_at"
FROM "client_commission_terms"
WHERE "closer_user_id" IS NOT NULL;
