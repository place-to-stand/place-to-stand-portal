CREATE TYPE "public"."meeting_status" AS ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "meeting_status" DEFAULT 'SCHEDULED' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"meet_link" text,
	"calendar_event_id" text,
	"attendee_emails" text[] DEFAULT '{}' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"title" text NOT NULL,
	"doc_url" text,
	"doc_id" text,
	"template_doc_id" text,
	"status" "proposal_status" DEFAULT 'DRAFT' NOT NULL,
	"estimated_value" numeric(12, 2),
	"expiration_date" date,
	"sent_at" timestamp with time zone,
	"sent_to_email" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_meetings_lead" ON "meetings" USING btree ("lead_id" uuid_ops) WHERE (deleted_at IS NULL AND lead_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_meetings_client" ON "meetings" USING btree ("client_id" uuid_ops) WHERE (deleted_at IS NULL AND client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_meetings_starts_at" ON "meetings" USING btree ("starts_at") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_meetings_calendar_event" ON "meetings" USING btree ("calendar_event_id" text_ops) WHERE (deleted_at IS NULL AND calendar_event_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_proposals_lead" ON "proposals" USING btree ("lead_id" uuid_ops) WHERE (deleted_at IS NULL AND lead_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_proposals_client" ON "proposals" USING btree ("client_id" uuid_ops) WHERE (deleted_at IS NULL AND client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_proposals_status" ON "proposals" USING btree ("status") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_proposals_doc_id" ON "proposals" USING btree ("doc_id" text_ops) WHERE (deleted_at IS NULL AND doc_id IS NOT NULL);