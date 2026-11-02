ALTER TABLE "invoices" ALTER COLUMN "tax_rate" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contacts_email_lower" ON "contacts" USING btree (lower(btrim(email))) WHERE email IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email_lower" ON "users" USING btree (lower(btrim(email)));--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "chk_invoice_line_items_amount" CHECK (amount = round(quantity * unit_price, 2));--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoices_total" CHECK (total = subtotal + tax_amount);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoices_paid_at" CHECK ((status = 'PAID') = (paid_at IS NOT NULL));