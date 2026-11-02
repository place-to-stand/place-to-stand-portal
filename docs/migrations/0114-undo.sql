-- Undo 0114 (drop the old client columns). Run in one transaction, before
-- 0113-undo:
--   psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f docs/migrations/0114-undo.sql
-- Puts companies.client_since / client_ended_at back. A company whose billing
-- is still exactly the stretch 0113 made from them gets its archived values;
-- one billed or changed since then gets them from its billing periods (first
-- month billed; the month after billing last ended, when it has ended).
ALTER TABLE "companies" ADD COLUMN "client_since" timestamp with time zone;
ALTER TABLE "companies" ADD COLUMN "client_ended_at" timestamp with time zone;
ALTER TABLE "companies" DISABLE TRIGGER USER;
UPDATE "companies" c SET "client_since" = a."client_since", "client_ended_at" = a."client_ended_at"
  FROM "archive_sales_tools"."company_client_dates_0114" a
  WHERE a."id" = c."id"
    AND (SELECT count(*) FROM "client_billing_periods" p WHERE p."company_id" = c."id" AND p."deleted_at" IS NULL) = 1
    AND NOT EXISTS (SELECT 1 FROM "client_billing_periods" p WHERE p."company_id" = c."id"
      AND (p."created_by" IS NOT NULL OR p."deleted_at" IS NOT NULL
        OR p."updated_at" IS DISTINCT FROM coalesce(a."client_ended_at", a."client_since")));
UPDATE "companies" c SET
    "client_since" = b."since",
    "client_ended_at" = CASE WHEN b."open" THEN NULL ELSE b."ended" END
  FROM (
    SELECT p."company_id",
      min(p."starts_on")::timestamptz AS "since",
      bool_or(p."ends_on" IS NULL) AS "open",
      (max(p."ends_on") + interval '1 month')::timestamptz AS "ended"
    FROM "client_billing_periods" p WHERE p."deleted_at" IS NULL GROUP BY p."company_id"
  ) b
  WHERE b."company_id" = c."id" AND c."client_since" IS NULL;
ALTER TABLE "companies" ENABLE TRIGGER USER;
CREATE INDEX "idx_companies_client" ON "companies" USING btree ("id") WHERE (client_since IS NOT NULL AND client_ended_at IS NULL);
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "id" = (SELECT max("id") FROM "drizzle"."__drizzle_migrations");
DROP TABLE "archive_sales_tools"."company_client_dates_0114";
