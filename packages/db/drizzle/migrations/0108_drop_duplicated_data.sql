-- Drop five copies of data stored elsewhere (no dropped value is lost):
--  1. clients.origination_contact_id / origination_user_id / closer_user_id:
--     commission lives on client_commission_terms (origination) and its
--     closer rows. The client columns were a cache of the newest term, and
--     closer_user_id has not been read since 0086.
--  2. contact_leads: leads.contact_id is the lead's contact.
--  3. hour_blocks.invoice_id: the block's invoice is the invoice of the line
--     that created it (hour_blocks.invoice_line_item_id).
--  4. clients.billing_type: billing type lives on client_billing_terms. The
--     column was a cache of the newest term (a change scheduled for next
--     month showed straight away); readers now take the newest term.
--     invoices.billing_type stays: it is a snapshot taken when invoicing.
--  5. client_commission_terms.closer_user_id: superseded by the closer rows
--     (client_commission_term_closers) in 0086 and never read since.
-- Everything dropped is copied into "archive_sales_tools" first. A client
-- with origination but no term gets one (effective from its creation month)
-- before the check. The guard below stops the whole batch, before anything
-- is dropped, if any value would not be recoverable from what stays.
-- Plain CREATE TABLE on purpose: an archive table that already exists stops
-- the migration rather than being reused.
CREATE SCHEMA IF NOT EXISTS "archive_sales_tools";
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."client_commission_columns" AS
SELECT "id" AS "client_id", "origination_contact_id", "origination_user_id",
       "closer_user_id"
FROM "clients"
WHERE "origination_contact_id" IS NOT NULL
   OR "origination_user_id" IS NOT NULL
   OR "closer_user_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."commission_term_closer_users" AS
SELECT "id" AS "term_id", "closer_user_id"
FROM "client_commission_terms"
WHERE "closer_user_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."contact_leads" AS
SELECT * FROM "contact_leads";
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."client_billing_types" AS
SELECT "id" AS "client_id", "billing_type" FROM "clients";
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."hour_block_invoices" AS
SELECT "id" AS "hour_block_id", "invoice_id", "invoice_line_item_id"
FROM "hour_blocks"
WHERE "invoice_id" IS NOT NULL;
--> statement-breakpoint

-- A client with origination but no live term at all gets one, from its
-- creation month, so the origination isn't lost.
INSERT INTO "client_commission_terms"
  ("client_id", "effective_from", "origination_user_id", "origination_contact_id")
SELECT c."id", date_trunc('month', c."created_at")::date,
       c."origination_user_id", c."origination_contact_id"
FROM "clients" c
WHERE (c."origination_user_id" IS NOT NULL OR c."origination_contact_id" IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "client_commission_terms" t
    WHERE t."client_id" = c."id" AND t."deleted_at" IS NULL
  );
--> statement-breakpoint

-- Stop before dropping anything if a value would be lost:
--  - a client's origination differs from its newest term's;
--  - a contact_leads row isn't its lead's contact;
--  - a block's invoice_id isn't the invoice of its line (or it has no line);
--  - a client has no billing term, a live client has none in force this
--    month, or the newest term's type isn't the client's billing_type;
--  - a commission term's old closer_user_id has no closer row on that term.
DO $$
DECLARE
  problems text;
BEGIN
  SELECT string_agg(line, E'\n') INTO problems FROM (
    SELECT format('client %s: origination differs from its newest commission term', c."id") AS line
    FROM "clients" c
    LEFT JOIN LATERAL (
      SELECT t."origination_user_id", t."origination_contact_id"
      FROM "client_commission_terms" t
      WHERE t."client_id" = c."id" AND t."deleted_at" IS NULL
      ORDER BY t."effective_from" DESC
      LIMIT 1
    ) cur ON true
    WHERE (c."origination_user_id" IS NOT NULL OR c."origination_contact_id" IS NOT NULL)
      AND (cur."origination_user_id" IS DISTINCT FROM c."origination_user_id"
        OR cur."origination_contact_id" IS DISTINCT FROM c."origination_contact_id")
    UNION ALL
    SELECT format('contact_leads: contact %s on lead %s is not the lead''s contact', cl."contact_id", cl."lead_id")
    FROM "contact_leads" cl
    LEFT JOIN "leads" l ON l."id" = cl."lead_id"
    WHERE l."id" IS NULL OR l."contact_id" IS DISTINCT FROM cl."contact_id"
    UNION ALL
    SELECT format('hour block %s: invoice %s is not its line''s invoice', hb."id", hb."invoice_id")
    FROM "hour_blocks" hb
    LEFT JOIN "invoice_line_items" li ON li."id" = hb."invoice_line_item_id"
    WHERE hb."invoice_id" IS NOT NULL
      AND li."invoice_id" IS DISTINCT FROM hb."invoice_id"
    UNION ALL
    SELECT format('client %s: billing type %s has no matching billing term (newest: %s)',
                  c."id", c."billing_type", cur."billing_type")
    FROM "clients" c
    LEFT JOIN LATERAL (
      SELECT t."billing_type" FROM "client_billing_terms" t
      WHERE t."client_id" = c."id" AND t."deleted_at" IS NULL
      ORDER BY t."effective_from" DESC
      LIMIT 1
    ) cur ON true
    WHERE cur."billing_type" IS DISTINCT FROM c."billing_type"
    UNION ALL
    SELECT format('client %s: no billing term in force this month', c."id")
    FROM "clients" c
    WHERE c."deleted_at" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "client_billing_terms" t
        WHERE t."client_id" = c."id" AND t."deleted_at" IS NULL
          AND t."effective_from" <= date_trunc('month', timezone('utc'::text, now()))::date
      )
    UNION ALL
    SELECT format('commission term %s: closer %s has no closer row', t."id", t."closer_user_id")
    FROM "client_commission_terms" t
    WHERE t."closer_user_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "client_commission_term_closers" c
        WHERE c."term_id" = t."id" AND c."closer_user_id" = t."closer_user_id"
      )
  ) p;

  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'These values would be lost. Fix them before 0108:\n%', problems;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "contact_leads" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "contact_leads" CASCADE;--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT "clients_origination_mutex";--> statement-breakpoint
ALTER TABLE "client_commission_terms" DROP CONSTRAINT "client_commission_terms_closer_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT "clients_origination_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT "clients_closer_user_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_clients_origination_contact_id";--> statement-breakpoint
DROP INDEX "idx_clients_origination_user_id";--> statement-breakpoint
DROP INDEX "idx_clients_closer_user_id";--> statement-breakpoint
DROP INDEX "idx_hour_blocks_invoice_id";--> statement-breakpoint
ALTER TABLE "client_commission_terms" DROP COLUMN "closer_user_id";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "billing_type";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "origination_contact_id";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "origination_user_id";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "closer_user_id";--> statement-breakpoint
ALTER TABLE "hour_blocks" DROP COLUMN "invoice_id";