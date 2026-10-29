-- A client's people are its company's people (company owns name, people,
-- notes and primary contact; the client is the billing side). The app keeps
-- contact_clients as a derived copy: every live contact at a company is
-- linked to every live client of that company. This brings existing data in
-- line. Additive only: no link or membership is removed, so nobody loses
-- portal access. Idempotent: safe to run twice.

-- 1. A contact with no company joins the company of the clients they're
--    linked to, when those clients all belong to one company. Contacts linked
--    across several companies are left for a person to sort out.
UPDATE "contacts" AS ct
SET "company_id" = linked."company_id",
    "updated_at" = now()
FROM (
  SELECT cc."contact_id", min(cl."company_id"::text)::uuid AS "company_id"
  FROM "contact_clients" cc
  JOIN "clients" cl ON cl."id" = cc."client_id"
  WHERE cl."deleted_at" IS NULL
    AND cl."company_id" IS NOT NULL
  GROUP BY cc."contact_id"
  HAVING count(DISTINCT cl."company_id") = 1
) AS linked
JOIN "companies" co ON co."id" = linked."company_id" AND co."deleted_at" IS NULL
WHERE ct."id" = linked."contact_id"
  AND ct."company_id" IS NULL
  AND ct."deleted_at" IS NULL;--> statement-breakpoint

-- 2. Promoted contacts get portal access to the clients they're about to be
--    linked to (step 3). Only where there's no membership row at all: a
--    membership an admin revoked stays revoked.
INSERT INTO "client_members" ("client_id", "user_id")
SELECT DISTINCT cl."id", ct."user_id"
FROM "contacts" ct
JOIN "clients" cl
  ON cl."company_id" = ct."company_id" AND cl."deleted_at" IS NULL
JOIN "companies" co ON co."id" = ct."company_id" AND co."deleted_at" IS NULL
WHERE ct."deleted_at" IS NULL
  AND ct."user_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "contact_clients" cc
    WHERE cc."contact_id" = ct."id" AND cc."client_id" = cl."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "client_members" cm
    WHERE cm."client_id" = cl."id" AND cm."user_id" = ct."user_id"
  );--> statement-breakpoint

-- 3. Link every live contact at a live company to every live client of it,
--    except where an admin revoked that person's portal access to that
--    client: the link would show access ("preview as contact") they don't
--    have.
INSERT INTO "contact_clients" ("contact_id", "client_id")
SELECT ct."id", cl."id"
FROM "contacts" ct
JOIN "clients" cl
  ON cl."company_id" = ct."company_id" AND cl."deleted_at" IS NULL
JOIN "companies" co ON co."id" = ct."company_id" AND co."deleted_at" IS NULL
WHERE ct."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "client_members" cm
    WHERE cm."client_id" = cl."id"
      AND cm."user_id" = ct."user_id"
      AND cm."deleted_at" IS NOT NULL
  )
ON CONFLICT ("contact_id", "client_id") DO NOTHING;
