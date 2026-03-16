ALTER TABLE "proposals" ADD COLUMN "content_hash_at_signing" varchar(64);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "countersign_token" varchar(64);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "countersigner_name" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "countersigner_email" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "countersignature_data" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "countersigner_ip_address" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "countersignature_consent" boolean;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "countersigned_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_proposals_countersign_token" ON "proposals" USING btree ("countersign_token") WHERE (deleted_at IS NULL AND countersign_token IS NOT NULL);--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_countersign_token_unique" UNIQUE("countersign_token");