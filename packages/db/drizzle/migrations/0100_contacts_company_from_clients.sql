-- Contacts with no company take the company of the clients they're linked
-- to. Company membership grants nothing: client access stays each client's
-- own people list (contact_clients / client_members), untouched here.
-- Idempotent: safe to run twice.

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
  AND ct."deleted_at" IS NULL;
