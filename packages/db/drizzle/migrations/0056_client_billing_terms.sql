-- Preflight (PRD 002 F10): the backfill sentinel must predate all report-driving data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "time_logs" WHERE "logged_on" < DATE '2000-01-01')
     OR EXISTS (SELECT 1 FROM "hour_blocks" WHERE "created_at" < TIMESTAMPTZ '2000-01-01')
  THEN
    RAISE EXCEPTION 'client_billing_terms backfill sentinel 2000-01-01 does not predate existing data';
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE "client_billing_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"billing_type" "client_billing_type" NOT NULL,
	"effective_from" date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_client_billing_terms_month_start" CHECK (effective_from = date_trunc('month', effective_from)::date)
);
--> statement-breakpoint
ALTER TABLE "hour_blocks" ADD COLUMN "billing_month" date;--> statement-breakpoint
-- Backfill (PRD 002 D13): existing blocks keep their creation month, so
-- pre-migration reports render identically.
UPDATE "hour_blocks"
  SET "billing_month" = date_trunc('month', "created_at" AT TIME ZONE 'UTC')::date;--> statement-breakpoint
ALTER TABLE "hour_blocks" ALTER COLUMN "billing_month" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "client_billing_terms" ADD CONSTRAINT "client_billing_terms_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_billing_terms" ADD CONSTRAINT "client_billing_terms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_client_billing_terms_client_effective" ON "client_billing_terms" USING btree ("client_id","effective_from") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_client_billing_terms_resolution" ON "client_billing_terms" USING btree ("client_id","effective_from" DESC NULLS LAST) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_hour_blocks_billing_month" ON "hour_blocks" USING btree ("billing_month") WHERE (deleted_at IS NULL);--> statement-breakpoint
ALTER TABLE "hour_blocks" ADD CONSTRAINT "chk_hour_blocks_billing_month_month_start" CHECK (billing_month = date_trunc('month', billing_month)::date);--> statement-breakpoint
-- Backfill (PRD 002 D5): one term per existing client — including soft-deleted
-- clients — at a sentinel predating all data, so every historical month
-- resolves to exactly what it renders today.
INSERT INTO "client_billing_terms" ("client_id", "billing_type", "effective_from")
SELECT "id", "billing_type", DATE '2000-01-01'
FROM "clients";