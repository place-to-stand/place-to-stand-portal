-- Retire what memberships (0105) and lead-reads-through-contact (0106)
-- replace. Nothing is thrown away: every dropped table and column is copied
-- into the "archive_sales_tools" schema first, plus a list of any portal
-- link or grant that did not carry over (expected empty: 0105 makes every
-- client link a company membership and keeps every real portal login's
-- access on a live client, unless the login has no contact or only an
-- archived one). Two guards stop the whole batch before anything is
-- dropped: a live grant was lost, or someone gained access they didn't have.
-- Restore from there if anything is missed. Plain CREATE TABLE on purpose:
-- an archive table that already exists stops the migration rather than
-- being reused. leads.company_name was respelled by 0090; the name as typed
-- is in archive_sales_tools.lead_company_names (made by 0090).
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

-- What did not carry over after 0105 (live clients only; archived ones are
-- in the full copies above). Expected empty; the guard below stops if not.
--  - contact_clients: a contact linked to a client must now be a member of
--    the client's company (the link itself is not access).
--  - client_members: a real portal grant (a login on a client) must still
--    show in client_portal_access.
CREATE TABLE "archive_sales_tools"."unmapped_portal_access" AS
SELECT 'contact_clients'::text AS "source", cc."contact_id", c."user_id",
       cc."client_id", cl."company_id" AS "client_company_id",
       c."company_id" AS "contact_company_id"
FROM "contact_clients" cc
JOIN "contacts" c ON c."id" = cc."contact_id"
JOIN "clients" cl ON cl."id" = cc."client_id" AND cl."deleted_at" IS NULL
WHERE c."deleted_at" IS NULL
  AND cl."company_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "memberships" m
    WHERE m."contact_id" = cc."contact_id"
      AND m."company_id" = cl."company_id"
      AND m."ended_at" IS NULL
  )
UNION ALL
SELECT 'client_members', c."id", cm."user_id", cm."client_id",
       cl."company_id", c."company_id"
FROM "client_members" cm
JOIN "clients" cl ON cl."id" = cm."client_id" AND cl."deleted_at" IS NULL
LEFT JOIN "contacts" c ON c."user_id" = cm."user_id"
WHERE cm."deleted_at" IS NULL
  -- A grant whose contact is archived counts too: the view drops it
  -- (0105 starts archived contacts with access off), and before this
  -- release archiving a contact did not revoke its grant, so stop rather
  -- than silently remove access. Production pre-flight P11 expects none.
  -- A login switched off or archived on the Users page already had no
  -- access, so it is not counted.
  AND NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."id" = cm."user_id"
      AND (u."disabled_at" IS NOT NULL OR u."deleted_at" IS NOT NULL)
  )
  AND NOT EXISTS (
    SELECT 1 FROM "client_portal_access" a
    WHERE a."user_id" = cm."user_id" AND a."client_id" = cm."client_id"
  );
--> statement-breakpoint

-- Stop before dropping anything if a live grant did not carry over: an
-- archive keeps the record, but the person would lose access. Fix them
-- (give the person a live contact and a membership with portal access) and
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
    RAISE EXCEPTION E'These client links or portal logins did not carry over to memberships. Fix them before 0107:\n%', unmapped;
  END IF;
END $$;--> statement-breakpoint

-- And stop if anyone gained access: every (login, client) pair the new
-- client_portal_access view grants must have been a live client_members
-- grant before. 0105 only carries access from such grants, but a grant on
-- an archived client that shares its company with a live one (0096 name
-- matching), or any membership with access at a company whose client the
-- person never had, would widen access silently.
DO $$
DECLARE
  gained text;
BEGIN
  SELECT string_agg(
           format('login %s, contact %s, client %s',
                  a."user_id", a."contact_id", a."client_id"),
           E'\n')
    INTO gained
  FROM "client_portal_access" a
  WHERE NOT EXISTS (
    SELECT 1 FROM "client_members" cm
    WHERE cm."user_id" = a."user_id"
      AND cm."client_id" = a."client_id"
      AND cm."deleted_at" IS NULL
  );

  IF gained IS NOT NULL THEN
    RAISE EXCEPTION E'These people would gain client portal access they did not have. Fix their memberships before 0107:\n%', gained;
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
