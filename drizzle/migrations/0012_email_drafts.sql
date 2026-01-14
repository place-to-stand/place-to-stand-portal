CREATE TYPE "public"."draft_status" AS ENUM('COMPOSING', 'READY', 'SENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TABLE "email_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"thread_id" uuid,
	"gmail_draft_id" text,
	"compose_type" text NOT NULL,
	"in_reply_to_message_id" text,
	"to_emails" text[] DEFAULT '{}' NOT NULL,
	"cc_emails" text[] DEFAULT '{}' NOT NULL,
	"bcc_emails" text[] DEFAULT '{}' NOT NULL,
	"subject" text,
	"body_html" text,
	"body_text" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_id" uuid,
	"project_id" uuid,
	"status" "draft_status" DEFAULT 'COMPOSING' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"send_error" text,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "suggestions" DROP CONSTRAINT "suggestions_pr_requires_repo";--> statement-breakpoint
ALTER TABLE "suggestions" DROP CONSTRAINT "suggestions_github_repo_link_id_fkey";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_suggestions_repo";--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."oauth_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_drafts_user" ON "email_drafts" USING btree ("user_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_email_drafts_connection" ON "email_drafts" USING btree ("connection_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_email_drafts_scheduled" ON "email_drafts" USING btree ("scheduled_at") WHERE (deleted_at IS NULL AND status = 'READY' AND scheduled_at IS NOT NULL);--> statement-breakpoint
ALTER TABLE "suggestions" DROP COLUMN "github_repo_link_id";--> statement-breakpoint
ALTER TABLE "suggestions" DROP COLUMN "review_notes";--> statement-breakpoint
ALTER TABLE "suggestions" DROP COLUMN "created_pr_number";--> statement-breakpoint
ALTER TABLE "suggestions" DROP COLUMN "created_pr_url";