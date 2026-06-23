ALTER TABLE "email_drafts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meetings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "proposal_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "proposals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suggestions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "threads" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transcripts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "email_drafts" CASCADE;--> statement-breakpoint
DROP TABLE "email_templates" CASCADE;--> statement-breakpoint
DROP TABLE "meetings" CASCADE;--> statement-breakpoint
DROP TABLE "messages" CASCADE;--> statement-breakpoint
DROP TABLE "proposal_templates" CASCADE;--> statement-breakpoint
DROP TABLE "proposals" CASCADE;--> statement-breakpoint
DROP TABLE "suggestions" CASCADE;--> statement-breakpoint
DROP TABLE "threads" CASCADE;--> statement-breakpoint
DROP TABLE "transcripts" CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_proposal_id_fkey";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_invoices_proposal_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_leads_priority";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "proposal_id";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "overall_score";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "priority_tier";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "signals";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "last_scored_at";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "predicted_close_probability";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "estimated_value";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "google_meetings";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "google_proposals";--> statement-breakpoint
DROP TYPE "public"."draft_status";--> statement-breakpoint
DROP TYPE "public"."email_template_category";--> statement-breakpoint
DROP TYPE "public"."meeting_status";--> statement-breakpoint
DROP TYPE "public"."message_source";--> statement-breakpoint
DROP TYPE "public"."proposal_status";--> statement-breakpoint
DROP TYPE "public"."proposal_template_type";--> statement-breakpoint
DROP TYPE "public"."suggestion_status";--> statement-breakpoint
DROP TYPE "public"."suggestion_type";--> statement-breakpoint
DROP TYPE "public"."thread_classification";--> statement-breakpoint
DROP TYPE "public"."thread_status";--> statement-breakpoint
DROP TYPE "public"."transcript_classification";--> statement-breakpoint
DROP TYPE "public"."transcript_source";--> statement-breakpoint
DROP TYPE "public"."transcript_status";