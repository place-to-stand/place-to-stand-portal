CREATE TYPE "public"."transcript_classification" AS ENUM('UNCLASSIFIED', 'CLASSIFIED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."transcript_source" AS ENUM('DRIVE_SEARCH');--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"source" "transcript_source" NOT NULL,
	"drive_file_id" text,
	"drive_file_url" text,
	"meeting_date" timestamp with time zone,
	"duration_minutes" integer,
	"participant_names" text[] DEFAULT '{}' NOT NULL,
	"participant_emails" text[] DEFAULT '{}' NOT NULL,
	"classification" "transcript_classification" DEFAULT 'UNCLASSIFIED' NOT NULL,
	"client_id" uuid,
	"project_id" uuid,
	"lead_id" uuid,
	"classified_by" uuid,
	"classified_at" timestamp with time zone,
	"ai_suggested_client_id" uuid,
	"ai_suggested_client_name" text,
	"ai_suggested_project_id" uuid,
	"ai_suggested_project_name" text,
	"ai_suggested_lead_id" uuid,
	"ai_suggested_lead_name" text,
	"ai_confidence" numeric(4, 3),
	"ai_analyzed_at" timestamp with time zone,
	"synced_by" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "transcripts_ai_confidence_range" CHECK (ai_confidence >= 0 AND ai_confidence <= 1)
);
--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_classified_by_fkey" FOREIGN KEY ("classified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_synced_by_fkey" FOREIGN KEY ("synced_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transcripts_drive_file" ON "transcripts" USING btree ("drive_file_id") WHERE (deleted_at IS NULL AND drive_file_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_transcripts_classification" ON "transcripts" USING btree ("classification") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_transcripts_client" ON "transcripts" USING btree ("client_id" uuid_ops) WHERE (deleted_at IS NULL AND client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_transcripts_project" ON "transcripts" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL AND project_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_transcripts_lead" ON "transcripts" USING btree ("lead_id" uuid_ops) WHERE (deleted_at IS NULL AND lead_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_transcripts_meeting_date" ON "transcripts" USING btree ("meeting_date" DESC NULLS FIRST) WHERE (deleted_at IS NULL);