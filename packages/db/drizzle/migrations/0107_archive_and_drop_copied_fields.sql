-- Retire what memberships (0105) and lead-reads-through-contact (0106)
-- replace. Nothing is thrown away: every dropped table and column is copied
-- into the "archive_sales_tools" schema first, plus a list of any portal
-- grant that did not carry over (expected empty: 0105 gives everyone with
-- access a membership at the client's company; a portal login with no
-- contact is the one case it can't). Restore from there if anything is missed.
CREATE SCHEMA IF NOT EXISTS "archive_sales_tools";
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."contact_clients" AS
SELECT * FROM "contact_clients";
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."client_members" AS
SELECT * FROM "client_members";
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."contact_company" AS
SELECT "id" AS "contact_id", "company_id", "job_title"
FROM "contacts"
WHERE "company_id" IS NOT NULL OR "job_title" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."company_primary_contact" AS
SELECT "id" AS "company_id", "primary_contact_id"
FROM "companies"
WHERE "primary_contact_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."lead_contact_copies" AS
SELECT "id" AS "lead_id", "contact_name", "contact_email", "contact_phone",
       "company_name", "company_website"
FROM "leads";
--> statement-breakpoint

-- Portal grants with no matching current, portal-enabled membership after
-- 0105 (live clients only; grants on archived clients are in the full copies
-- above). The pre-release check lists these.
CREATE TABLE "archive_sales_tools"."unmapped_portal_access" AS
SELECT 'contact_clients'::text AS "source", cc."contact_id", c."user_id",
       cc."client_id", cl."company_id" AS "client_company_id",
       c."company_id" AS "contact_company_id"
FROM "contact_clients" cc
JOIN "contacts" c ON c."id" = cc."contact_id"
JOIN "clients" cl ON cl."id" = cc."client_id" AND cl."deleted_at" IS NULL
WHERE c."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "client_portal_access" a
    WHERE a."contact_id" = cc."contact_id" AND a."client_id" = cc."client_id"
  )
UNION ALL
SELECT 'client_members', c."id", cm."user_id", cm."client_id",
       cl."company_id", c."company_id"
FROM "client_members" cm
JOIN "clients" cl ON cl."id" = cm."client_id" AND cl."deleted_at" IS NULL
LEFT JOIN "contacts" c ON c."user_id" = cm."user_id"
WHERE cm."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "client_portal_access" a
    WHERE a."user_id" = cm."user_id" AND a."client_id" = cm."client_id"
  );
--> statement-breakpoint

-- Stop before dropping anything if a live grant did not carry over: an
-- archive keeps the record, but the person would lose access. Fix them
-- (give the person a contact and a membership with portal access) and
-- re-run. Nothing above has dropped anything yet.
DO $$
DECLARE
  unmapped text;
BEGIN
  SELECT string_agg(
           format('%s: contact %s, login %s, client %s',
                  u."source", u."contact_id", u."user_id", u."client_id"),
           E'\n')
    INTO unmapped
  FROM "archive_sales_tools"."unmapped_portal_access" u;

  IF unmapped IS NOT NULL THEN
    RAISE EXCEPTION E'These portal grants have no matching membership. Fix them before 0107:\n%', unmapped;
  END IF;
END $$;--> statement-breakpoint
DROP TABLE "contact_clients";
--> statement-breakpoint
DROP TABLE "client_members";
--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN "company_id";
--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN "job_title";
--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "primary_contact_id";
--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "contact_name";
--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "contact_email";
--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "contact_phone";
--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "company_name";
--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "company_website";
