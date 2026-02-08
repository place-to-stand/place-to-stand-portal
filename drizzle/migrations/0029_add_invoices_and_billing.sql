CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'SENT', 'VIEWED', 'PAID', 'PARTIALLY_PAID', 'REFUNDED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."line_item_type" AS ENUM('HOURS_PREPAID', 'HOURS_WORKED', 'CUSTOM');--> statement-breakpoint
CREATE TABLE "billing_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"hourly_rate" numeric(12, 2) DEFAULT '200.00' NOT NULL,
	"invoice_prefix" varchar(10) DEFAULT 'PTS' NOT NULL,
	"company_name" text,
	"company_address" text,
	"company_phone" text,
	"company_email" text,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	CONSTRAINT "billing_settings_singleton" CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"type" "line_item_type" NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"hour_block_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "invoice_line_items_amount_check" CHECK (amount = quantity * unit_price)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"status" "invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"invoice_number" varchar(20),
	"billing_period_start" date,
	"billing_period_end" date,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"share_token" varchar(64),
	"share_enabled" boolean DEFAULT false,
	"viewed_at" timestamp with time zone,
	"viewed_count" integer DEFAULT 0,
	"stripe_payment_intent_id" varchar(255),
	"payment_method" varchar(50),
	"notes" text,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "invoices_share_token_unique" UNIQUE("share_token"),
	CONSTRAINT "invoices_invoice_number_format" CHECK ((invoice_number IS NULL) OR (invoice_number ~ '^[A-Z]+-[0-9]{4}-[0-9]{4,}$'::text))
);
--> statement-breakpoint
ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_hour_block_id_fkey" FOREIGN KEY ("hour_block_id") REFERENCES "public"."hour_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_line_items_invoice" ON "invoice_line_items" USING btree ("invoice_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_client" ON "invoices" USING btree ("client_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_created_by" ON "invoices" USING btree ("created_by" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "invoices" USING btree ("due_date") WHERE (deleted_at IS NULL AND due_date IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_share_token" ON "invoices" USING btree ("share_token") WHERE (deleted_at IS NULL AND share_token IS NOT NULL AND share_enabled = true);--> statement-breakpoint
CREATE INDEX "idx_invoices_invoice_number" ON "invoices" USING btree ("invoice_number") WHERE (deleted_at IS NULL AND invoice_number IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_stripe_pi" ON "invoices" USING btree ("stripe_payment_intent_id") WHERE (deleted_at IS NULL AND stripe_payment_intent_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_stripe_pi_unique" ON "invoices" USING btree ("stripe_payment_intent_id") WHERE (stripe_payment_intent_id IS NOT NULL);--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1;--> statement-breakpoint
INSERT INTO billing_settings (id, hourly_rate, invoice_prefix, payment_terms_days, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 200.00, 'PTS', 30, NOW())
ON CONFLICT DO NOTHING;