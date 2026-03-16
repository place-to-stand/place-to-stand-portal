ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "share_token" varchar(64);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "share_password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "share_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "viewed_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "client_comment" text;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposals_share_token_unique') THEN
    ALTER TABLE "proposals" ADD CONSTRAINT "proposals_share_token_unique" UNIQUE("share_token");
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_proposals_share_token" ON "proposals" USING btree ("share_token") WHERE (deleted_at IS NULL AND share_token IS NOT NULL AND share_enabled = true);
