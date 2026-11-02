-- The company owns its website; the client sheet no longer edits a client's
-- own copy. Carry each client's website onto its linked company where the
-- company has none, so nothing typed on a client is lost. When several live
-- clients point at one company, the most recently updated client's website
-- wins. Blank values are ignored and an existing company website is never
-- overwritten. clients.website stays for now (dropped later). Idempotent: a
-- second run finds nothing to fill.
UPDATE "companies" AS co
SET "website" = src."website",
    "updated_at" = now()
FROM (
  SELECT DISTINCT ON (c."company_id")
    c."company_id",
    trim(c."website") AS "website"
  FROM "clients" c
  WHERE c."deleted_at" IS NULL
    AND c."company_id" IS NOT NULL
    AND nullif(trim(c."website"), '') IS NOT NULL
  ORDER BY c."company_id", c."updated_at" DESC, c."created_at" DESC
) AS src
WHERE co."id" = src."company_id"
  AND nullif(trim(co."website"), '') IS NULL;
