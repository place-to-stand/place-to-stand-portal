ALTER TABLE "form_submissions" ADD COLUMN "feedback_helpful" boolean;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "feedback_comment" text;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "feedback_at" timestamp with time zone;