CREATE TABLE "business_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"legal_name" text,
	"website" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"country" text,
	"phone" text,
	"inbox_email" text,
	"sending_email" text,
	"booking_url" text,
	"time_zone" text DEFAULT 'America/Chicago' NOT NULL,
	"logo_data_url" text,
	"icon_data_url" text,
	"confirmed_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_single_row" CHECK ("business_settings"."id")
);
--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;