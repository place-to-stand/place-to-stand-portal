CREATE TYPE "public"."transcript_status" AS ENUM('PENDING', 'PROCESSING', 'AVAILABLE', 'FETCHED', 'NOT_RECORDED', 'FAILED');--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "conference_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "conference_record_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "transcript_file_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "transcript_text" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "transcript_status" "transcript_status" DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "transcript_fetched_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_meetings_conference" ON "meetings" USING btree ("conference_id" text_ops) WHERE (deleted_at IS NULL AND conference_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_meetings_transcript_pending" ON "meetings" USING btree ("transcript_status") WHERE (deleted_at IS NULL AND transcript_status IN ('PENDING', 'PROCESSING', 'AVAILABLE'));