-- Best-effort relink before dropping the denormalized column: any block still
-- carrying a bare invoice_number gets its invoice_id resolved by number match.
-- Prod is already fully linked (backfill, Aug 2026); this covers stale
-- fixture/dev rows so the link survives the drop where an invoice exists.
UPDATE "hour_blocks" hb
SET "invoice_id" = i."id"
FROM "invoices" i
WHERE hb."invoice_id" IS NULL
  AND hb."invoice_number" IS NOT NULL
  AND i."invoice_number" = hb."invoice_number"
  AND i."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "hour_blocks" DROP CONSTRAINT "hour_blocks_invoice_number_format";--> statement-breakpoint
ALTER TABLE "hour_blocks" DROP COLUMN "invoice_number";
