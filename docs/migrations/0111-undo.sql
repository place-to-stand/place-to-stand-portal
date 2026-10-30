-- Undo 0111 (clients into companies). Run in one transaction:
--   psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f docs/migrations/0111-undo.sql
-- Rebuilds `clients` from archive_sales_tools.clients_0111 and puts every
-- client_id back from archive_sales_tools.client_refs_0111. Rows made after
-- 0111 (new projects, invoices, hour blocks, terms, updates) map back to
-- their company's live client, else its newest stopped one; a company made
-- a client only after 0111 gets a new client row with the company's id.

-- Companies first made clients after 0111 need a client row to point at.
INSERT INTO "archive_sales_tools"."clients_0111" ("id", "slug", "notes", "created_by", "created_at", "updated_at", "deleted_at", "website", "state", "company_id", "label")
  SELECT co."id", co."slug", NULL, co."created_by", COALESCE(co."client_since", co."created_at"), co."updated_at", CASE WHEN co."client_since" IS NULL THEN COALESCE(co."client_ended_at", now()) ELSE co."client_ended_at" END, NULL, co."state", co."id", NULL
  FROM "companies" co
  WHERE (co."client_since" IS NOT NULL
      -- or anything billed still points at it (e.g. a client deleted since)
      OR EXISTS (SELECT 1 FROM "projects" x WHERE x."company_id" = co."id")
      OR EXISTS (SELECT 1 FROM "hour_blocks" x WHERE x."company_id" = co."id")
      OR EXISTS (SELECT 1 FROM "invoices" x WHERE x."company_id" = co."id")
      OR EXISTS (SELECT 1 FROM "billing_terms" x WHERE x."company_id" = co."id")
      OR EXISTS (SELECT 1 FROM "commission_terms" x WHERE x."company_id" = co."id")
      OR EXISTS (SELECT 1 FROM "client_updates" x WHERE x."company_id" = co."id")
      OR EXISTS (SELECT 1 FROM "github_app_installations" x WHERE x."company_id" = co."id"))
    AND NOT EXISTS (SELECT 1 FROM "archive_sales_tools"."clients_0111" a WHERE a."company_id" = co."id");

-- company → the client a new row belongs to.
CREATE TEMP TABLE "undo_company_client" ON COMMIT DROP AS
  SELECT DISTINCT ON ("company_id") "company_id", "id" AS "client_id"
  FROM "archive_sales_tools"."clients_0111"
  ORDER BY "company_id", ("deleted_at" IS NULL) DESC, "deleted_at" DESC NULLS FIRST, "created_at" DESC;

DROP VIEW "client_portal_access";

CREATE TABLE "clients" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slug" text,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "deleted_at" timestamp with time zone,
  "website" text,
  "state" character varying(2),
  "company_id" uuid NOT NULL,
  "label" text
);
INSERT INTO "clients" SELECT "id", "slug", "notes", "created_by", "created_at", "updated_at", "deleted_at", "website", "state", "company_id", "label" FROM "archive_sales_tools"."clients_0111";
-- Billing state changed since 0111 is the company's now: carry it back.
UPDATE "clients" cl SET
  "slug" = co."slug",
  "state" = co."state",
  "deleted_at" = CASE WHEN co."client_ended_at" IS NULL AND co."client_since" IS NOT NULL THEN NULL ELSE COALESCE(cl."deleted_at", co."client_ended_at", now()) END
FROM "undo_company_client" uc JOIN "companies" co ON co."id" = uc."company_id"
WHERE cl."id" = uc."client_id";
ALTER TABLE "clients" ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");
ALTER TABLE "clients" ADD CONSTRAINT "clients_slug_key" UNIQUE ("slug");
CREATE UNIQUE INDEX "clients_company_id_live_key" ON "clients" USING btree ("company_id") WHERE (("deleted_at" IS NULL) AND ("company_id" IS NOT NULL));
CREATE INDEX "idx_clients_company" ON "clients" USING btree ("company_id") WHERE (("deleted_at" IS NULL) AND ("company_id" IS NOT NULL));
CREATE INDEX "idx_clients_created_by" ON "clients" USING btree ("created_by") WHERE ("deleted_at" IS NULL);
CREATE INDEX "idx_clients_slug_trgm" ON "clients" USING gin ("slug" gin_trgm_ops);
CREATE TRIGGER "clients_set_updated_at" BEFORE UPDATE ON "clients" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL;
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");

-- Foreign keys off, names and columns back.
ALTER TABLE "projects" DROP CONSTRAINT "projects_company_id_fkey";
ALTER TABLE "hour_blocks" DROP CONSTRAINT "hour_blocks_company_id_fkey";
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_company_id_fkey";
ALTER TABLE "billing_terms" DROP CONSTRAINT "billing_terms_company_id_fkey";
ALTER TABLE "commission_terms" DROP CONSTRAINT "commission_terms_company_id_fkey";
ALTER TABLE "client_updates" DROP CONSTRAINT "client_updates_company_id_fkey";
ALTER TABLE "github_app_installations" DROP CONSTRAINT "github_app_installations_company_id_fkey";

ALTER TABLE "commission_term_closers" RENAME TO "client_commission_term_closers";
ALTER TABLE "commission_terms" RENAME TO "client_commission_terms";
ALTER TABLE "billing_terms" RENAME TO "client_billing_terms";
ALTER TABLE "client_billing_terms" RENAME CONSTRAINT "billing_terms_pkey" TO "client_billing_terms_pkey";
ALTER TABLE "client_billing_terms" RENAME CONSTRAINT "billing_terms_created_by_fkey" TO "client_billing_terms_created_by_fkey";
ALTER TABLE "client_billing_terms" RENAME CONSTRAINT "chk_billing_terms_month_start" TO "chk_client_billing_terms_month_start";
ALTER INDEX "idx_billing_terms_resolution" RENAME TO "idx_client_billing_terms_resolution";
ALTER INDEX "uq_billing_terms_company_effective" RENAME TO "uq_client_billing_terms_client_effective";
ALTER TABLE "client_commission_terms" RENAME CONSTRAINT "commission_terms_pkey" TO "client_commission_terms_pkey";
ALTER TABLE "client_commission_terms" RENAME CONSTRAINT "commission_terms_origination_user_id_fkey" TO "client_commission_terms_origination_user_id_fkey";
ALTER TABLE "client_commission_terms" RENAME CONSTRAINT "commission_terms_origination_contact_id_fkey" TO "client_commission_terms_origination_contact_id_fkey";
ALTER TABLE "client_commission_terms" RENAME CONSTRAINT "commission_terms_created_by_fkey" TO "client_commission_terms_created_by_fkey";
ALTER TABLE "client_commission_terms" RENAME CONSTRAINT "chk_commission_terms_month_start" TO "chk_client_commission_terms_month_start";
ALTER TABLE "client_commission_terms" RENAME CONSTRAINT "chk_commission_terms_origination_mutex" TO "chk_client_commission_terms_origination_mutex";
ALTER INDEX "idx_commission_terms_resolution" RENAME TO "idx_client_commission_terms_resolution";
ALTER INDEX "uq_commission_terms_company_effective" RENAME TO "uq_client_commission_terms_client_effective";
ALTER TABLE "client_commission_term_closers" RENAME CONSTRAINT "commission_term_closers_pkey" TO "client_commission_term_closers_pkey";
ALTER TABLE "client_commission_term_closers" RENAME CONSTRAINT "commission_term_closers_term_id_fkey" TO "client_commission_term_closers_term_id_fkey";
ALTER TABLE "client_commission_term_closers" RENAME CONSTRAINT "commission_term_closers_closer_user_id_fkey" TO "client_commission_term_closers_closer_user_id_fkey";
ALTER TABLE "client_commission_term_closers" RENAME CONSTRAINT "commission_term_closers_closer_contact_id_fkey" TO "client_commission_term_closers_closer_contact_id_fkey";
ALTER TABLE "client_commission_term_closers" RENAME CONSTRAINT "chk_commission_term_closers_one_party" TO "chk_client_commission_term_closers_one_party";
ALTER TABLE "client_commission_term_closers" RENAME CONSTRAINT "chk_commission_term_closers_share" TO "chk_client_commission_term_closers_share";
ALTER INDEX "idx_commission_term_closers_term" RENAME TO "idx_client_commission_term_closers_term";
ALTER INDEX "uq_commission_term_closers_user" RENAME TO "uq_client_commission_term_closers_user";
ALTER INDEX "uq_commission_term_closers_contact" RENAME TO "uq_client_commission_term_closers_contact";
ALTER TABLE "projects" RENAME CONSTRAINT "projects_type_company_check" TO "projects_type_client_check";
ALTER INDEX "idx_projects_company" RENAME TO "idx_projects_client";
ALTER INDEX "idx_hour_blocks_company_id" RENAME TO "idx_hour_blocks_client_id";
ALTER INDEX "idx_invoices_company_id" RENAME TO "idx_invoices_client_id";
ALTER INDEX "idx_client_updates_company_created" RENAME TO "idx_client_updates_client_created";
ALTER INDEX "idx_github_app_installations_company" RENAME TO "idx_github_app_installations_client";

ALTER TABLE "projects" RENAME COLUMN "company_id" TO "client_id";
ALTER TABLE "hour_blocks" RENAME COLUMN "company_id" TO "client_id";
ALTER TABLE "invoices" RENAME COLUMN "company_id" TO "client_id";
ALTER TABLE "client_billing_terms" RENAME COLUMN "company_id" TO "client_id";
ALTER TABLE "client_commission_terms" RENAME COLUMN "company_id" TO "client_id";
ALTER TABLE "client_updates" RENAME COLUMN "company_id" TO "client_id";
ALTER TABLE "github_app_installations" RENAME COLUMN "company_id" TO "client_id";
ALTER TABLE "activity_logs" RENAME COLUMN "target_company_id" TO "target_client_id";

-- Ids back: archived rows exactly, newer rows through their company.
ALTER TABLE "projects" DISABLE TRIGGER USER;
ALTER TABLE "hour_blocks" DISABLE TRIGGER USER;
ALTER TABLE "activity_logs" DISABLE TRIGGER USER;
UPDATE "projects" t SET "client_id" = COALESCE((SELECT r."client_id" FROM "archive_sales_tools"."client_refs_0111" r JOIN "archive_sales_tools"."client_id_map" mm ON mm."client_id" = r."client_id" WHERE r."table_name" = 'projects' AND r."id" = t."id" AND mm."company_id" = uc."company_id"), uc."client_id") FROM "undo_company_client" uc WHERE uc."company_id" = t."client_id";
UPDATE "hour_blocks" t SET "client_id" = COALESCE((SELECT r."client_id" FROM "archive_sales_tools"."client_refs_0111" r JOIN "archive_sales_tools"."client_id_map" mm ON mm."client_id" = r."client_id" WHERE r."table_name" = 'hour_blocks' AND r."id" = t."id" AND mm."company_id" = uc."company_id"), uc."client_id") FROM "undo_company_client" uc WHERE uc."company_id" = t."client_id";
UPDATE "invoices" t SET "client_id" = COALESCE((SELECT r."client_id" FROM "archive_sales_tools"."client_refs_0111" r JOIN "archive_sales_tools"."client_id_map" mm ON mm."client_id" = r."client_id" WHERE r."table_name" = 'invoices' AND r."id" = t."id" AND mm."company_id" = uc."company_id"), uc."client_id") FROM "undo_company_client" uc WHERE uc."company_id" = t."client_id";
UPDATE "client_billing_terms" t SET "client_id" = COALESCE((SELECT r."client_id" FROM "archive_sales_tools"."client_refs_0111" r JOIN "archive_sales_tools"."client_id_map" mm ON mm."client_id" = r."client_id" WHERE r."table_name" = 'client_billing_terms' AND r."id" = t."id" AND mm."company_id" = uc."company_id"), uc."client_id") FROM "undo_company_client" uc WHERE uc."company_id" = t."client_id";
UPDATE "client_commission_terms" t SET "client_id" = COALESCE((SELECT r."client_id" FROM "archive_sales_tools"."client_refs_0111" r JOIN "archive_sales_tools"."client_id_map" mm ON mm."client_id" = r."client_id" WHERE r."table_name" = 'client_commission_terms' AND r."id" = t."id" AND mm."company_id" = uc."company_id"), uc."client_id") FROM "undo_company_client" uc WHERE uc."company_id" = t."client_id";
UPDATE "client_updates" t SET "client_id" = COALESCE((SELECT r."client_id" FROM "archive_sales_tools"."client_refs_0111" r JOIN "archive_sales_tools"."client_id_map" mm ON mm."client_id" = r."client_id" WHERE r."table_name" = 'client_updates' AND r."id" = t."id" AND mm."company_id" = uc."company_id"), uc."client_id") FROM "undo_company_client" uc WHERE uc."company_id" = t."client_id";
UPDATE "github_app_installations" t SET "client_id" = COALESCE((SELECT r."client_id" FROM "archive_sales_tools"."client_refs_0111" r JOIN "archive_sales_tools"."client_id_map" mm ON mm."client_id" = r."client_id" WHERE r."table_name" = 'github_app_installations' AND r."id" = t."id" AND mm."company_id" = uc."company_id"), uc."client_id") FROM "undo_company_client" uc WHERE uc."company_id" = t."client_id";
UPDATE "activity_logs" t SET "target_client_id" = COALESCE((SELECT r."client_id" FROM "archive_sales_tools"."client_refs_0111" r JOIN "archive_sales_tools"."client_id_map" mm ON mm."client_id" = r."client_id" WHERE r."table_name" = 'activity_logs.target_client_id' AND r."id" = t."id" AND mm."company_id" = uc."company_id"), uc."client_id") FROM "undo_company_client" uc WHERE uc."company_id" = t."target_client_id";
UPDATE "activity_logs" t SET "target_id" = COALESCE((SELECT r."client_id" FROM "archive_sales_tools"."client_refs_0111" r JOIN "archive_sales_tools"."client_id_map" mm ON mm."client_id" = r."client_id" WHERE r."table_name" = 'activity_logs.target_id' AND r."id" = t."id" AND mm."company_id" = uc."company_id"), uc."client_id") FROM "undo_company_client" uc WHERE t."target_type" = 'CLIENT' AND uc."company_id" = t."target_id";
ALTER TABLE "projects" ENABLE TRIGGER USER;
ALTER TABLE "hour_blocks" ENABLE TRIGGER USER;
ALTER TABLE "activity_logs" ENABLE TRIGGER USER;
-- Closed-month reports keep what they hold now (a month reclosed after the
-- release keeps its new figures); only the ids go back to client ids.
DO $$
DECLARE pair record;
BEGIN
  FOR pair IN SELECT "company_id", "client_id" FROM "undo_company_client" WHERE "company_id" <> "client_id" LOOP
    UPDATE "monthly_close_snapshots"
      SET "report" = replace("report"::text, pair."company_id"::text, pair."client_id"::text)::jsonb
      WHERE "report"::text LIKE '%' || pair."company_id"::text || '%';
  END LOOP;
END $$;

ALTER TABLE "leads" ADD COLUMN "converted_to_client_id" uuid;
UPDATE "leads" l SET "converted_to_client_id" = r."client_id" FROM "archive_sales_tools"."client_refs_0111" r WHERE r."table_name" = 'leads.converted_to_client_id' AND r."id" = l."id";

ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id");
ALTER TABLE "hour_blocks" ADD CONSTRAINT "hour_blocks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT;
ALTER TABLE "client_billing_terms" ADD CONSTRAINT "client_billing_terms_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT;
ALTER TABLE "client_commission_terms" ADD CONSTRAINT "client_commission_terms_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT;
ALTER TABLE "client_updates" ADD CONSTRAINT "client_updates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;
ALTER TABLE "github_app_installations" ADD CONSTRAINT "github_app_installations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id");
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_to_client_id_fkey" FOREIGN KEY ("converted_to_client_id") REFERENCES "clients"("id");

-- Notes and website go back to what they were before 0111 where nobody has
-- edited them since (still what 0111 wrote); an edit since the release stays.
ALTER TABLE "companies" DISABLE TRIGGER USER;
UPDATE "companies" co SET "notes" = b."notes"
  FROM "archive_sales_tools"."companies_0111" b
  JOIN "archive_sales_tools"."companies_after_0111" w ON w."id" = b."id"
  WHERE b."id" = co."id" AND co."notes" IS NOT DISTINCT FROM w."notes";
UPDATE "companies" co SET "website" = b."website"
  FROM "archive_sales_tools"."companies_0111" b
  JOIN "archive_sales_tools"."companies_after_0111" w ON w."id" = b."id"
  WHERE b."id" = co."id" AND co."website" IS NOT DISTINCT FROM w."website";
ALTER TABLE "companies" ENABLE TRIGGER USER;
DROP INDEX "idx_companies_client";
ALTER TABLE "companies" DROP CONSTRAINT "companies_slug_key";
ALTER TABLE "companies" DROP COLUMN "client_ended_at";
ALTER TABLE "companies" DROP COLUMN "client_since";
ALTER TABLE "companies" DROP COLUMN "state";
ALTER TABLE "companies" DROP COLUMN "slug";

CREATE VIEW "client_portal_access" AS
  SELECT cl.id AS client_id,
    m.contact_id,
    c.user_id
  FROM memberships m
    JOIN clients cl ON cl.company_id = m.company_id AND cl.deleted_at IS NULL
    JOIN contacts c ON c.id = m.contact_id AND c.deleted_at IS NULL AND c.user_id IS NOT NULL
    JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL AND u.disabled_at IS NULL
  WHERE m.ended_at IS NULL AND m.portal_access;

DELETE FROM "drizzle"."__drizzle_migrations" WHERE "id" = (SELECT max("id") FROM "drizzle"."__drizzle_migrations");
DROP TABLE "archive_sales_tools"."client_id_map";
DROP TABLE "archive_sales_tools"."clients_0111";
DROP TABLE "archive_sales_tools"."companies_0111";
DROP TABLE "archive_sales_tools"."companies_after_0111";
DROP TABLE "archive_sales_tools"."client_refs_0111";
DROP TABLE "archive_sales_tools"."monthly_close_snapshots_0111";
