ALTER TABLE "form_submissions" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "acknowledged_by" uuid;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_form_submissions_unread" ON "form_submissions" USING btree ("kind" enum_ops,"status" enum_ops) WHERE (deleted_at IS NULL AND acknowledged_at IS NULL);--> statement-breakpoint
-- Backfill: treat everything that predates the acknowledgement feature as
-- read, so the unread badge starts at 0 instead of counting historical rows.
UPDATE "form_submissions"
SET "acknowledged_at" = timezone('utc'::text, now())
WHERE "deleted_at" IS NULL;
