-- The company owns its website; the lead sheet no longer edits a lead's own
-- copy. Carry each lead's website onto its linked company where the company
-- has none, so nothing typed on a lead is lost. When several live leads
-- point at one company, the most recently updated lead's website wins.
-- Blank values are ignored and an existing company website is never
-- overwritten. leads.company_website stays for now (dropped later with the
-- other lead display copies). Idempotent: a second run finds nothing to fill.
UPDATE "companies" AS co
SET "website" = src."website",
    "updated_at" = now()
FROM (
  SELECT DISTINCT ON (l."company_id")
    l."company_id",
    trim(l."company_website") AS "website"
  FROM "leads" l
  WHERE l."deleted_at" IS NULL
    AND l."company_id" IS NOT NULL
    AND nullif(trim(l."company_website"), '') IS NOT NULL
  ORDER BY l."company_id", l."updated_at" DESC, l."created_at" DESC
) AS src
WHERE co."id" = src."company_id"
  AND nullif(trim(co."website"), '') IS NULL;
