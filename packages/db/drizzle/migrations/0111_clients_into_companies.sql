-- 0111: a client is a company you bill. The clients table folds into
-- companies (slug, state, client_since, client_ended_at) and everything keyed
-- on client_id keys on company_id. Old client ids are kept in
-- archive_sales_tools.client_id_map so the CLI/MCP can accept them for one
-- release. Undo SQL: docs/migrations/sales-tools-rollout.md (0111).
--
-- Order: archive → guards (abort before any change) → company columns →
-- repoint every client_id → rename the term tables → drop clients.

-- 1. Archive everything this migration rewrites or drops.
CREATE SCHEMA IF NOT EXISTS "archive_sales_tools";--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."clients_0111" AS SELECT * FROM "clients";--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."client_id_map" (
  "client_id" uuid PRIMARY KEY,
  "company_id" uuid NOT NULL
);--> statement-breakpoint
INSERT INTO "archive_sales_tools"."client_id_map" ("client_id", "company_id")
  SELECT "id", "company_id" FROM "clients";--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."companies_0111" AS SELECT * FROM "companies";--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."client_refs_0111" AS
  SELECT 'projects'::text AS "table_name", "id", "client_id" FROM "projects" WHERE "client_id" IS NOT NULL
  UNION ALL SELECT 'hour_blocks', "id", "client_id" FROM "hour_blocks"
  UNION ALL SELECT 'invoices', "id", "client_id" FROM "invoices"
  UNION ALL SELECT 'client_billing_terms', "id", "client_id" FROM "client_billing_terms"
  UNION ALL SELECT 'client_commission_terms', "id", "client_id" FROM "client_commission_terms"
  UNION ALL SELECT 'client_updates', "id", "client_id" FROM "client_updates"
  UNION ALL SELECT 'github_app_installations', "id", "client_id" FROM "github_app_installations" WHERE "client_id" IS NOT NULL
  UNION ALL SELECT 'leads.converted_to_client_id', "id", "converted_to_client_id" FROM "leads" WHERE "converted_to_client_id" IS NOT NULL
  UNION ALL SELECT 'activity_logs.target_client_id', "id", "target_client_id" FROM "activity_logs" WHERE "target_client_id" IS NOT NULL
  UNION ALL SELECT 'activity_logs.target_id', "id", "target_id" FROM "activity_logs" WHERE "target_type" = 'CLIENT' AND "target_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."monthly_close_snapshots_0111" AS
  SELECT "id", "report" FROM "monthly_close_snapshots";--> statement-breakpoint

-- 2. Guards: stop the batch, before any change, on data this can't fold.
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(cl."id"::text, ', ') INTO bad
  FROM "clients" cl LEFT JOIN "companies" co ON co."id" = cl."company_id"
  WHERE co."id" IS NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0111: clients without a company: %', bad;
  END IF;

  -- Two clients of one company would merge their terms: one term per month.
  SELECT string_agg(DISTINCT x."company_id"::text, ', ') INTO bad FROM (
    SELECT cl."company_id"
    FROM "client_billing_terms" t JOIN "clients" cl ON cl."id" = t."client_id"
    WHERE t."deleted_at" IS NULL
    GROUP BY cl."company_id", t."effective_from"
    HAVING count(*) > 1
  ) x;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0111: billing terms collide when merged onto company %', bad;
  END IF;

  SELECT string_agg(DISTINCT x."company_id"::text, ', ') INTO bad FROM (
    SELECT cl."company_id"
    FROM "client_commission_terms" t JOIN "clients" cl ON cl."id" = t."client_id"
    WHERE t."deleted_at" IS NULL
    GROUP BY cl."company_id", t."effective_from"
    HAVING count(*) > 1
  ) x;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0111: commission terms collide when merged onto company %', bad;
  END IF;

  -- Every live client must be its company's only live one (it is: 0096's
  -- clients_company_id_live_key), so a company is a client at most once.
  SELECT string_agg("company_id"::text, ', ') INTO bad FROM (
    SELECT "company_id" FROM "clients" WHERE "deleted_at" IS NULL
    GROUP BY 1 HAVING count(*) > 1
  ) x;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0111: companies with two live clients: %', bad;
  END IF;

  -- Labels told two billing setups apart; there is no place for them now.
  SELECT string_agg("id"::text, ', ') INTO bad
  FROM "clients" WHERE "label" IS NOT NULL AND btrim("label") <> '';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0111: clients with a label (decide by hand): %', bad;
  END IF;
END $$;--> statement-breakpoint

-- 3. The company carries what was the client's: slug, state, and when it
--    was billed. The company's own record (the live client, else the most
--    recently stopped one) gives slug, state and website; every client's
--    notes are kept, after the company's.
ALTER TABLE "companies" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "client_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "client_ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" DISABLE TRIGGER USER;--> statement-breakpoint
WITH ranked AS (
  SELECT cl.*,
    row_number() OVER (
      PARTITION BY cl."company_id"
      ORDER BY (cl."deleted_at" IS NULL) DESC, cl."deleted_at" DESC NULLS FIRST, cl."created_at" DESC
    ) AS rn
  FROM "clients" cl
), per_company AS (
  SELECT
    "company_id",
    min("created_at") AS "since",
    CASE WHEN bool_or("deleted_at" IS NULL) THEN NULL ELSE max("deleted_at") END AS "ended",
    string_agg(NULLIF(btrim("notes"), ''), E'\n\n' ORDER BY "created_at") AS "notes"
  FROM "clients" GROUP BY "company_id"
)
UPDATE "companies" co SET
  "slug" = r."slug",
  "state" = r."state",
  "website" = COALESCE(NULLIF(btrim(co."website"), ''), r."website", co."website"),
  "client_since" = pc."since",
  "client_ended_at" = pc."ended",
  "notes" = CASE
    WHEN pc."notes" IS NULL THEN co."notes"
    WHEN NULLIF(btrim(co."notes"), '') IS NULL THEN pc."notes"
    WHEN position(pc."notes" IN co."notes") > 0 THEN co."notes"
    ELSE co."notes" || E'\n\n' || pc."notes"
  END
FROM ranked r JOIN per_company pc ON pc."company_id" = r."company_id"
WHERE r."company_id" = co."id" AND r.rn = 1;--> statement-breakpoint
ALTER TABLE "companies" ENABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_slug_key" UNIQUE("slug");--> statement-breakpoint
CREATE INDEX "idx_companies_client" ON "companies" USING btree ("id") WHERE (client_since IS NOT NULL AND client_ended_at IS NULL);--> statement-breakpoint

-- 4. Repoint every client_id at its company. Updated-at triggers stay off
--    so the move doesn't look like an edit (close drift reads them).
DROP VIEW "client_portal_access";--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_client_id_fkey";--> statement-breakpoint
ALTER TABLE "hour_blocks" DROP CONSTRAINT "hour_blocks_client_id_fkey";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_client_id_fkey";--> statement-breakpoint
ALTER TABLE "client_billing_terms" DROP CONSTRAINT "client_billing_terms_client_id_fkey";--> statement-breakpoint
ALTER TABLE "client_commission_terms" DROP CONSTRAINT "client_commission_terms_client_id_fkey";--> statement-breakpoint
ALTER TABLE "client_updates" DROP CONSTRAINT "client_updates_client_id_fkey";--> statement-breakpoint
ALTER TABLE "github_app_installations" DROP CONSTRAINT "github_app_installations_client_id_fkey";--> statement-breakpoint
ALTER TABLE "leads" DROP CONSTRAINT "leads_converted_to_client_id_fkey";--> statement-breakpoint
ALTER TABLE "projects" DISABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "hour_blocks" DISABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "activity_logs" DISABLE TRIGGER USER;--> statement-breakpoint
UPDATE "projects" t SET "client_id" = m."company_id" FROM "archive_sales_tools"."client_id_map" m WHERE t."client_id" = m."client_id";--> statement-breakpoint
UPDATE "hour_blocks" t SET "client_id" = m."company_id" FROM "archive_sales_tools"."client_id_map" m WHERE t."client_id" = m."client_id";--> statement-breakpoint
UPDATE "invoices" t SET "client_id" = m."company_id" FROM "archive_sales_tools"."client_id_map" m WHERE t."client_id" = m."client_id";--> statement-breakpoint
UPDATE "client_billing_terms" t SET "client_id" = m."company_id" FROM "archive_sales_tools"."client_id_map" m WHERE t."client_id" = m."client_id";--> statement-breakpoint
UPDATE "client_commission_terms" t SET "client_id" = m."company_id" FROM "archive_sales_tools"."client_id_map" m WHERE t."client_id" = m."client_id";--> statement-breakpoint
UPDATE "client_updates" t SET "client_id" = m."company_id" FROM "archive_sales_tools"."client_id_map" m WHERE t."client_id" = m."client_id";--> statement-breakpoint
UPDATE "github_app_installations" t SET "client_id" = m."company_id" FROM "archive_sales_tools"."client_id_map" m WHERE t."client_id" = m."client_id";--> statement-breakpoint
UPDATE "activity_logs" t SET "target_client_id" = m."company_id" FROM "archive_sales_tools"."client_id_map" m WHERE t."target_client_id" = m."client_id";--> statement-breakpoint
UPDATE "activity_logs" t SET "target_id" = m."company_id" FROM "archive_sales_tools"."client_id_map" m WHERE t."target_type" = 'CLIENT' AND t."target_id" = m."client_id";--> statement-breakpoint
ALTER TABLE "projects" ENABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "hour_blocks" ENABLE TRIGGER USER;--> statement-breakpoint
ALTER TABLE "activity_logs" ENABLE TRIGGER USER;--> statement-breakpoint

-- Close snapshots keep the ids they were closed with; rewrite them to the
-- company ids so a closed month still lines up with live data. Ids are
-- UUIDs, so a text replace can only hit the id itself.
DO $$
DECLARE
  pair record;
BEGIN
  FOR pair IN SELECT "client_id", "company_id" FROM "archive_sales_tools"."client_id_map" WHERE "client_id" <> "company_id" LOOP
    UPDATE "monthly_close_snapshots"
      SET "report" = replace("report"::text, pair."client_id"::text, pair."company_id"::text)::jsonb
      WHERE "report"::text LIKE '%' || pair."client_id"::text || '%';
  END LOOP;
END $$;--> statement-breakpoint

ALTER TABLE "projects" RENAME COLUMN "client_id" TO "company_id";--> statement-breakpoint
ALTER TABLE "hour_blocks" RENAME COLUMN "client_id" TO "company_id";--> statement-breakpoint
ALTER TABLE "invoices" RENAME COLUMN "client_id" TO "company_id";--> statement-breakpoint
ALTER TABLE "client_billing_terms" RENAME COLUMN "client_id" TO "company_id";--> statement-breakpoint
ALTER TABLE "client_commission_terms" RENAME COLUMN "client_id" TO "company_id";--> statement-breakpoint
ALTER TABLE "client_updates" RENAME COLUMN "client_id" TO "company_id";--> statement-breakpoint
ALTER TABLE "github_app_installations" RENAME COLUMN "client_id" TO "company_id";--> statement-breakpoint
ALTER TABLE "activity_logs" RENAME COLUMN "target_client_id" TO "target_company_id";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "converted_to_client_id";--> statement-breakpoint

-- 5. The term tables lose their "client_" prefix; names follow.
ALTER TABLE "client_billing_terms" RENAME TO "billing_terms";--> statement-breakpoint
ALTER TABLE "client_commission_terms" RENAME TO "commission_terms";--> statement-breakpoint
ALTER TABLE "client_commission_term_closers" RENAME TO "commission_term_closers";--> statement-breakpoint
ALTER TABLE "billing_terms" RENAME CONSTRAINT "client_billing_terms_pkey" TO "billing_terms_pkey";--> statement-breakpoint
ALTER TABLE "billing_terms" RENAME CONSTRAINT "client_billing_terms_created_by_fkey" TO "billing_terms_created_by_fkey";--> statement-breakpoint
ALTER TABLE "billing_terms" RENAME CONSTRAINT "chk_client_billing_terms_month_start" TO "chk_billing_terms_month_start";--> statement-breakpoint
ALTER INDEX "idx_client_billing_terms_resolution" RENAME TO "idx_billing_terms_resolution";--> statement-breakpoint
ALTER INDEX "uq_client_billing_terms_client_effective" RENAME TO "uq_billing_terms_company_effective";--> statement-breakpoint
ALTER TABLE "commission_terms" RENAME CONSTRAINT "client_commission_terms_pkey" TO "commission_terms_pkey";--> statement-breakpoint
ALTER TABLE "commission_terms" RENAME CONSTRAINT "client_commission_terms_origination_user_id_fkey" TO "commission_terms_origination_user_id_fkey";--> statement-breakpoint
ALTER TABLE "commission_terms" RENAME CONSTRAINT "client_commission_terms_origination_contact_id_fkey" TO "commission_terms_origination_contact_id_fkey";--> statement-breakpoint
ALTER TABLE "commission_terms" RENAME CONSTRAINT "client_commission_terms_created_by_fkey" TO "commission_terms_created_by_fkey";--> statement-breakpoint
ALTER TABLE "commission_terms" RENAME CONSTRAINT "chk_client_commission_terms_month_start" TO "chk_commission_terms_month_start";--> statement-breakpoint
ALTER TABLE "commission_terms" RENAME CONSTRAINT "chk_client_commission_terms_origination_mutex" TO "chk_commission_terms_origination_mutex";--> statement-breakpoint
ALTER INDEX "idx_client_commission_terms_resolution" RENAME TO "idx_commission_terms_resolution";--> statement-breakpoint
ALTER INDEX "uq_client_commission_terms_client_effective" RENAME TO "uq_commission_terms_company_effective";--> statement-breakpoint
ALTER TABLE "commission_term_closers" RENAME CONSTRAINT "client_commission_term_closers_pkey" TO "commission_term_closers_pkey";--> statement-breakpoint
ALTER TABLE "commission_term_closers" RENAME CONSTRAINT "client_commission_term_closers_term_id_fkey" TO "commission_term_closers_term_id_fkey";--> statement-breakpoint
ALTER TABLE "commission_term_closers" RENAME CONSTRAINT "client_commission_term_closers_closer_user_id_fkey" TO "commission_term_closers_closer_user_id_fkey";--> statement-breakpoint
ALTER TABLE "commission_term_closers" RENAME CONSTRAINT "client_commission_term_closers_closer_contact_id_fkey" TO "commission_term_closers_closer_contact_id_fkey";--> statement-breakpoint
ALTER TABLE "commission_term_closers" RENAME CONSTRAINT "chk_client_commission_term_closers_one_party" TO "chk_commission_term_closers_one_party";--> statement-breakpoint
ALTER TABLE "commission_term_closers" RENAME CONSTRAINT "chk_client_commission_term_closers_share" TO "chk_commission_term_closers_share";--> statement-breakpoint
ALTER INDEX "idx_client_commission_term_closers_term" RENAME TO "idx_commission_term_closers_term";--> statement-breakpoint
ALTER INDEX "uq_client_commission_term_closers_user" RENAME TO "uq_commission_term_closers_user";--> statement-breakpoint
ALTER INDEX "uq_client_commission_term_closers_contact" RENAME TO "uq_commission_term_closers_contact";--> statement-breakpoint
ALTER TABLE "projects" RENAME CONSTRAINT "projects_type_client_check" TO "projects_type_company_check";--> statement-breakpoint
ALTER INDEX "idx_projects_client" RENAME TO "idx_projects_company";--> statement-breakpoint
ALTER INDEX "idx_hour_blocks_client_id" RENAME TO "idx_hour_blocks_company_id";--> statement-breakpoint
ALTER INDEX "idx_invoices_client_id" RENAME TO "idx_invoices_company_id";--> statement-breakpoint
ALTER INDEX "idx_client_updates_client_created" RENAME TO "idx_client_updates_company_created";--> statement-breakpoint
ALTER INDEX "idx_github_app_installations_client" RENAME TO "idx_github_app_installations_company";--> statement-breakpoint

-- 6. Foreign keys to companies, same delete rules as before.
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hour_blocks" ADD CONSTRAINT "hour_blocks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_terms" ADD CONSTRAINT "billing_terms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_terms" ADD CONSTRAINT "commission_terms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_updates" ADD CONSTRAINT "client_updates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_app_installations" ADD CONSTRAINT "github_app_installations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- 7. Portal access: a current, portal-enabled membership at a company that
--    is a client now (same rule as before, read off the company).
DROP TABLE "clients";--> statement-breakpoint
CREATE VIEW "client_portal_access" AS
  SELECT co.id AS company_id,
    m.contact_id,
    c.user_id
  FROM memberships m
    JOIN companies co ON co.id = m.company_id AND co.client_since IS NOT NULL AND co.client_ended_at IS NULL
    JOIN contacts c ON c.id = m.contact_id AND c.deleted_at IS NULL AND c.user_id IS NOT NULL
    JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL AND u.disabled_at IS NULL
  WHERE m.ended_at IS NULL AND m.portal_access;
