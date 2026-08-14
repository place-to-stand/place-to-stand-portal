CREATE TYPE "public"."lead_update_type" AS ENUM('MEETING', 'PHONE_CALL', 'EMAIL', 'NOTE');--> statement-breakpoint
CREATE TABLE "lead_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" "lead_update_type" NOT NULL,
	"body" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lead_updates" ADD CONSTRAINT "lead_updates_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_updates" ADD CONSTRAINT "lead_updates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lead_updates_lead_occurred" ON "lead_updates" USING btree ("lead_id" uuid_ops,"occurred_at" timestamptz_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_lead_updates_author" ON "lead_updates" USING btree ("author_id" uuid_ops) WHERE (deleted_at IS NULL);