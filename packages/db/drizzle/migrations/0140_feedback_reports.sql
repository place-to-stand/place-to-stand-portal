CREATE TYPE "public"."feedback_type" AS ENUM('bug', 'request', 'question');--> statement-breakpoint
CREATE TABLE "feedback_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "feedback_type" NOT NULL,
	"message" text NOT NULL,
	"page_url" text,
	"page_title" text,
	"screenshot_path" text,
	"screenshot_mime_type" text,
	"screenshot_size" integer,
	"reporter_user_id" uuid,
	"reporter_name" text,
	"reporter_email" text,
	"origin" text,
	"user_agent" text,
	"viewport" text,
	"language" text,
	"timezone" text,
	"posthog_session_id" text,
	"posthog_replay_url" text,
	"spam_reason" text,
	"task_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "feedback_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "feedback_origins" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_feedback_reports_created_at" ON "feedback_reports" USING btree ("created_at" DESC NULLS LAST) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_feedback_reports_project" ON "feedback_reports" USING btree ("project_id" uuid_ops,"created_at" DESC NULLS LAST) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_feedback_reports_task" ON "feedback_reports" USING btree ("task_id" uuid_ops) WHERE (task_id IS NOT NULL);