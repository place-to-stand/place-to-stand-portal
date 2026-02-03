CREATE TYPE "public"."email_template_category" AS ENUM('FOLLOW_UP', 'PROPOSAL', 'MEETING', 'INTRODUCTION');--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" "email_template_category" NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "email_drafts" DROP CONSTRAINT "email_drafts_connection_id_fkey";
--> statement-breakpoint
ALTER TABLE "email_drafts" ALTER COLUMN "connection_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD COLUMN "send_via" text DEFAULT 'gmail' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_templates_category" ON "email_templates" USING btree ("category") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_email_templates_default" ON "email_templates" USING btree ("category") WHERE (deleted_at IS NULL AND is_default = true);--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."oauth_connections"("id") ON DELETE set null ON UPDATE no action;