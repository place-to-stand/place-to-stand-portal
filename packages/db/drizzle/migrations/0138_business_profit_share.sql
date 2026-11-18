ALTER TABLE "business_settings" ADD COLUMN "profit_share_starts_on" date;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "profit_share_minimum_balance" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "profit_share_partner_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;