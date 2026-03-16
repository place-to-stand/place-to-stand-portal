CREATE TYPE "public"."thread_classification" AS ENUM('UNCLASSIFIED', 'CLASSIFIED', 'DISMISSED');--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "classification" "thread_classification" DEFAULT 'UNCLASSIFIED' NOT NULL;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "classified_by" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "classified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_classified_by_fkey" FOREIGN KEY ("classified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_threads_classification" ON "threads" USING btree ("classification") WHERE (deleted_at IS NULL);--> statement-breakpoint
UPDATE threads SET classification = 'CLASSIFIED', classified_at = NOW()
WHERE deleted_at IS NULL
  AND (client_id IS NOT NULL OR project_id IS NOT NULL OR lead_id IS NOT NULL);