CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'SENT', 'VIEWED', 'PAID', 'VOID');--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"product_catalog_item_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"creates_hour_block" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text,
	"status" "invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"client_id" uuid NOT NULL,
	"created_by" uuid,
	"proposal_id" uuid,
	"issued_date" date,
	"due_date" date,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 4) DEFAULT '0',
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"share_token" varchar(64),
	"share_enabled" boolean DEFAULT false NOT NULL,
	"viewed_at" timestamp with time zone,
	"viewed_count" integer DEFAULT 0 NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "invoices_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "product_catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit_price" numeric(12, 2) NOT NULL,
	"unit_label" text DEFAULT 'unit' NOT NULL,
	"creates_hour_block_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hour_blocks" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "hour_blocks" ADD COLUMN "invoice_line_item_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_product_catalog_item_id_fkey" FOREIGN KEY ("product_catalog_item_id") REFERENCES "public"."product_catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice_id" ON "invoice_line_items" USING btree ("invoice_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_product_catalog" ON "invoice_line_items" USING btree ("product_catalog_item_id" uuid_ops) WHERE (deleted_at IS NULL AND product_catalog_item_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_client_id" ON "invoices" USING btree ("client_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_created_by" ON "invoices" USING btree ("created_by" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_share_token" ON "invoices" USING btree ("share_token") WHERE (deleted_at IS NULL AND share_token IS NOT NULL AND share_enabled = true);--> statement-breakpoint
CREATE INDEX "idx_invoices_stripe_checkout_session" ON "invoices" USING btree ("stripe_checkout_session_id") WHERE (stripe_checkout_session_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_invoices_proposal_id" ON "invoices" USING btree ("proposal_id" uuid_ops) WHERE (deleted_at IS NULL AND proposal_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_product_catalog_items_active" ON "product_catalog_items" USING btree ("sort_order") WHERE (deleted_at IS NULL AND is_active = true);--> statement-breakpoint
CREATE INDEX "idx_hour_blocks_invoice_id" ON "hour_blocks" USING btree ("invoice_id" uuid_ops) WHERE (deleted_at IS NULL AND invoice_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hour_blocks_invoice_line_item_unique" ON "hour_blocks" USING btree ("invoice_line_item_id") WHERE (deleted_at IS NULL AND invoice_line_item_id IS NOT NULL);--> statement-breakpoint
ALTER TABLE "hour_blocks" ADD CONSTRAINT "hour_blocks_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hour_blocks" ADD CONSTRAINT "hour_blocks_invoice_line_item_id_fkey" FOREIGN KEY ("invoice_line_item_id") REFERENCES "public"."invoice_line_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1;--> statement-breakpoint
INSERT INTO product_catalog_items (name, description, unit_price, unit_label, creates_hour_block_default, sort_order) VALUES
  ('Development Hours', 'Software development and engineering time', 200.00, 'hour', true, 1),
  ('Server Cost', 'Monthly server hosting and infrastructure', 0.00, 'month', false, 2),
  ('Domain Registration', 'Annual domain name registration', 0.00, 'year', false, 3);