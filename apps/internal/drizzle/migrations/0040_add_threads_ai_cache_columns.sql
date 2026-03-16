ALTER TABLE "threads" ADD COLUMN "ai_suggested_client_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "ai_suggested_client_name" text;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "ai_suggested_project_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "ai_suggested_project_name" text;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "ai_suggested_lead_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "ai_suggested_lead_name" text;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "ai_confidence" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "ai_analyzed_at" timestamp with time zone;