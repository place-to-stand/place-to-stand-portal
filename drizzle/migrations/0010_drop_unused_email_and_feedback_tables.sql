-- Drop unused tables (IF EXISTS for idempotency when tables don't exist)
DROP TABLE IF EXISTS "email_raw" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "message_attachments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "suggestion_feedback" CASCADE;
