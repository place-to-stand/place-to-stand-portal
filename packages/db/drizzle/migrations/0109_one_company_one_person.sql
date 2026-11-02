-- One company, one person (docs/migrations/one-company-one-person.md):
--  - a client is its company's billing record: its name is the company's
--    (clients.name dropped) and it always has a company;
--  - a user is a person's sign-in: their name is their contact's
--    (users.full_name dropped) and every live user has exactly one live
--    contact. Staff with no contact get one at the "Place To Stand" company.
-- Both dropped columns are copied into "archive_sales_tools" first. A guard
-- stops the whole batch, before anything is dropped, if a client has no
-- company or a live user would be left without exactly one live contact.
-- Plain CREATE TABLE on purpose: an archive table that already exists stops
-- the migration rather than being reused.
CREATE SCHEMA IF NOT EXISTS "archive_sales_tools";
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."client_names" AS
SELECT cl."id" AS "client_id", cl."name", co."name" AS "company_name"
FROM "clients" cl
LEFT JOIN "companies" co ON co."id" = cl."company_id";
--> statement-breakpoint
CREATE TABLE "archive_sales_tools"."user_names" AS
SELECT "id" AS "user_id", "full_name", "email", "role" FROM "users";
--> statement-breakpoint

-- Staff need a company to belong to.
-- What existed before, so a rollback can remove exactly what this adds.
CREATE TABLE "archive_sales_tools"."ids_before_0109" AS
  SELECT 'company'::text AS "kind", "id" FROM "companies"
  UNION ALL SELECT 'contact', "id" FROM "contacts"
  UNION ALL SELECT 'membership', "id" FROM "memberships";--> statement-breakpoint
INSERT INTO "companies" ("name", "website")
SELECT 'Place To Stand', 'placetostandagency.com'
WHERE EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."role" IN ('ADMIN', 'SALES') AND u."deleted_at" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "contacts" c
                      WHERE c."user_id" = u."id" AND c."deleted_at" IS NULL)
  )
  AND NOT EXISTS (SELECT 1 FROM "companies" WHERE lower("name") = 'place to stand');
--> statement-breakpoint

-- A live user without a contact is linked to an unlinked live contact with
-- the same email (exact, case-insensitive), when there is exactly one.
UPDATE "contacts" c
SET "user_id" = u."id", "updated_at" = timezone('utc'::text, now())
FROM "users" u
WHERE u."deleted_at" IS NULL
  AND c."user_id" IS NULL AND c."deleted_at" IS NULL
  AND lower(c."email") = lower(u."email")
  AND NOT EXISTS (SELECT 1 FROM "contacts" x
                  WHERE x."user_id" = u."id" AND x."deleted_at" IS NULL)
  AND (SELECT count(*) FROM "contacts" y
       WHERE lower(y."email") = lower(u."email")
         AND y."user_id" IS NULL AND y."deleted_at" IS NULL) = 1;
--> statement-breakpoint

-- Anyone still without a contact gets one, named as their user was.
INSERT INTO "contacts" ("name", "email", "user_id")
SELECT coalesce(nullif(btrim(u."full_name"), ''), u."email"), u."email", u."id"
FROM "users" u
WHERE u."deleted_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "contacts" c
                  WHERE c."user_id" = u."id" AND c."deleted_at" IS NULL);
--> statement-breakpoint

-- Staff belong to Place To Stand.
INSERT INTO "memberships" ("contact_id", "company_id", "title")
SELECT c."id", co."id", CASE u."role" WHEN 'SALES' THEN 'Sales' ELSE 'Partner' END
FROM "users" u
JOIN "contacts" c ON c."user_id" = u."id" AND c."deleted_at" IS NULL
JOIN "companies" co ON lower(co."name") = 'place to stand'
WHERE u."role" IN ('ADMIN', 'SALES') AND u."deleted_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "memberships" m
                  WHERE m."contact_id" = c."id" AND m."company_id" = co."id"
                    AND m."ended_at" IS NULL);
--> statement-breakpoint

DO $$
DECLARE
  problems text;
BEGIN
  SELECT string_agg(line, E'\n') INTO problems FROM (
    SELECT format('client %s has no company', cl."id") AS line
    FROM "clients" cl WHERE cl."company_id" IS NULL
    UNION ALL
    SELECT format('user %s has %s live contacts', u."id",
                  (SELECT count(*) FROM "contacts" c
                   WHERE c."user_id" = u."id" AND c."deleted_at" IS NULL))
    FROM "users" u
    WHERE u."deleted_at" IS NULL
      AND (SELECT count(*) FROM "contacts" c
           WHERE c."user_id" = u."id" AND c."deleted_at" IS NULL) <> 1
  ) p;

  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'Fix these before 0109:\n%', problems;
  END IF;
END $$;--> statement-breakpoint

CREATE TABLE "archive_sales_tools"."created_0109" AS
  SELECT 'company'::text AS "kind", co."id" FROM "companies" co
    WHERE NOT EXISTS (SELECT 1 FROM "archive_sales_tools"."ids_before_0109" b WHERE b."kind" = 'company' AND b."id" = co."id")
  UNION ALL SELECT 'contact', c."id" FROM "contacts" c
    WHERE NOT EXISTS (SELECT 1 FROM "archive_sales_tools"."ids_before_0109" b WHERE b."kind" = 'contact' AND b."id" = c."id")
  UNION ALL SELECT 'membership', m."id" FROM "memberships" m
    WHERE NOT EXISTS (SELECT 1 FROM "archive_sales_tools"."ids_before_0109" b WHERE b."kind" = 'membership' AND b."id" = m."id");--> statement-breakpoint
DROP INDEX "idx_clients_name";--> statement-breakpoint
DROP INDEX "idx_clients_name_trgm";--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "full_name";