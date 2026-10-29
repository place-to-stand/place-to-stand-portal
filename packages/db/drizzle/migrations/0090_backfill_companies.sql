-- One-off backfill for the sales Companies page. Until now a lead held its
-- company only as free text (company_name). Turn each distinct name on a live
-- lead into a company record, then link leads and their contacts to it.

-- One company per name (case- and space-insensitive). The spelling and owner
-- come from the most recently touched lead, preferring a spelling that isn't
-- all lower case; the website from the newest lead that has one.
INSERT INTO "companies" ("name", "website", "owner_id", "created_at", "updated_at")
SELECT DISTINCT ON (lower(btrim(l."company_name")))
  btrim(l."company_name"),
  (
    SELECT btrim(w."company_website")
    FROM "leads" w
    WHERE w."deleted_at" IS NULL
      AND lower(btrim(w."company_name")) = lower(btrim(l."company_name"))
      -- Only values the company sheet accepts: a URL or a bare domain.
      AND btrim(w."company_website") ~* '^(https?://)?[^[:space:]/]+\.[^[:space:]]+$'
    ORDER BY w."updated_at" DESC
    LIMIT 1
  ),
  l."assignee_id",
  l."created_at",
  timezone('utc'::text, now())
FROM "leads" l
WHERE l."deleted_at" IS NULL
  AND l."company_name" IS NOT NULL
  AND btrim(l."company_name") <> ''
  -- The app caps names at 160 characters; longer legacy text stays on the
  -- lead unlinked rather than overflowing the unique name index.
  AND length(btrim(l."company_name")) <= 160
ORDER BY
  lower(btrim(l."company_name")),
  (btrim(l."company_name") = lower(btrim(l."company_name"))),
  l."updated_at" DESC
ON CONFLICT (lower(btrim("name"))) WHERE "deleted_at" IS NULL DO NOTHING;
--> statement-breakpoint

-- Link every lead (archived ones too) whose name matches, and give it the
-- company's spelling, as a lead save does.
UPDATE "leads" l
SET "company_id" = c."id", "company_name" = c."name"
FROM "companies" c
WHERE l."company_id" IS NULL
  AND l."company_name" IS NOT NULL
  AND lower(btrim(l."company_name")) = lower(btrim(c."name"))
  AND c."deleted_at" IS NULL;
--> statement-breakpoint

-- A contact joins the company of its most recently touched live lead.
UPDATE "contacts" ct
SET "company_id" = sub."company_id"
FROM (
  SELECT DISTINCT ON (cl."contact_id") cl."contact_id", l."company_id"
  FROM "contact_leads" cl
  JOIN "leads" l ON l."id" = cl."lead_id"
  WHERE l."company_id" IS NOT NULL
    AND l."deleted_at" IS NULL
  ORDER BY cl."contact_id", l."updated_at" DESC
) sub
WHERE ct."id" = sub."contact_id"
  AND ct."company_id" IS NULL;
--> statement-breakpoint

-- Companies whose lead already converted point at that client.
UPDATE "companies" c
SET "client_id" = sub."client_id"
FROM (
  SELECT DISTINCT ON (l."company_id") l."company_id", l."converted_to_client_id" AS "client_id"
  FROM "leads" l
  JOIN "clients" cl ON cl."id" = l."converted_to_client_id" AND cl."deleted_at" IS NULL
  WHERE l."company_id" IS NOT NULL
    AND l."converted_to_client_id" IS NOT NULL
  ORDER BY l."company_id", l."converted_at" DESC NULLS LAST
) sub
WHERE c."id" = sub."company_id"
  AND c."client_id" IS NULL;
