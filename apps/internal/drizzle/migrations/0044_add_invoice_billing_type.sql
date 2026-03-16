ALTER TABLE "invoices" ADD COLUMN "billing_type" "client_billing_type";

-- Backfill existing invoices from their client's billing type
UPDATE invoices
SET billing_type = clients.billing_type
FROM clients
WHERE invoices.client_id = clients.id
  AND invoices.billing_type IS NULL;