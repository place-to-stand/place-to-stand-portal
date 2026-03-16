CREATE TABLE "tax_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar(2) NOT NULL,
	"rate" numeric(5, 4) NOT NULL,
	"label" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	CONSTRAINT "tax_rates_state_unique" UNIQUE("state")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "product_catalog_items" ADD COLUMN "min_quantity" integer;--> statement-breakpoint
CREATE INDEX "idx_tax_rates_state" ON "tax_rates" USING btree ("state") WHERE (is_active = true);