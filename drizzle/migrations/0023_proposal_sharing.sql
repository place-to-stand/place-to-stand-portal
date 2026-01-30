ALTER TABLE "proposals" ADD COLUMN "share_token" varchar(64);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "share_password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "share_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "viewed_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "client_comment" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_share_token_unique" UNIQUE("share_token");--> statement-breakpoint
CREATE INDEX "idx_proposals_share_token" ON "proposals" USING btree ("share_token") WHERE (deleted_at IS NULL AND share_token IS NOT NULL AND share_enabled = true);
