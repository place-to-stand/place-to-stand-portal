CREATE TABLE "monthly_close_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"report" jsonb NOT NULL,
	"closed_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"closed_by" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_monthly_close_snapshots_month_range" CHECK (month BETWEEN 1 AND 12)
);
--> statement-breakpoint
ALTER TABLE "monthly_close_snapshots" ADD CONSTRAINT "monthly_close_snapshots_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_monthly_close_snapshots_period" ON "monthly_close_snapshots" USING btree ("year","month") WHERE (deleted_at IS NULL);