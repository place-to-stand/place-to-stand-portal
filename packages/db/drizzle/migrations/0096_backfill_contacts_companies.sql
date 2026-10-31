-- One-off backfill for the company-centred CRM (0095 added the columns).
--   1. Every client links to a company (existing link, a name match, or a
--      new company named after the client).
--   2. Every lead links to a contact: matched or created by email (one
--      contact per email), or a new name-only contact when it has no email.
--   3. Contacts without a company take it from their lead or their client.
--   4. Each company's primary contact comes from its champion, else from
--      its client's primary contact flag.
-- Each data step only fills what is still empty, so re-running them is a
-- no-op. The two ADD CONSTRAINT statements are not repeatable: if this
-- migration fails, retry only after it has fully rolled back.
-- Run 0097 (which drops the old columns) only after this has succeeded and
-- the new code is deployed.

ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_primary_contact_id_fkey"
  FOREIGN KEY ("primary_contact_id") REFERENCES "public"."contacts"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- 1a. Companies already marked as signed (companies.client_id, set by lead
-- conversion) give their client its company.
UPDATE "clients" c
SET "company_id" = co."id"
FROM "companies" co
WHERE c."company_id" IS NULL
  AND co."client_id" = c."id"
  AND co."deleted_at" IS NULL;
--> statement-breakpoint

-- 1b. A live company with the client's name (case- and space-insensitive).
UPDATE "clients" c
SET "company_id" = co."id"
FROM "companies" co
WHERE c."company_id" IS NULL
  AND co."deleted_at" IS NULL
  AND lower(btrim(co."name")) = lower(btrim(c."name"));
--> statement-breakpoint

-- 1c. Otherwise a new company named after the client (one per name). A name
-- over the app's 160-character cap is shortened and tagged with the client
-- id, so two long names sharing a prefix never merge into one company.
INSERT INTO "companies" ("name", "website", "created_by", "created_at", "updated_at")
SELECT DISTINCT ON (lower("company_name"))
  "company_name",
  c."website",
  c."created_by",
  c."created_at",
  timezone('utc'::text, now())
FROM (
  SELECT c.*, CASE WHEN btrim(c."name") = '' THEN 'Client ' || left(c."id"::text, 8)
       WHEN length(btrim(c."name")) <= 160 THEN btrim(c."name")
       ELSE left(btrim(c."name"), 149) || ' (' || left(c."id"::text, 8) || ')' END AS "company_name"
  FROM "clients" c
) c
WHERE c."company_id" IS NULL
ORDER BY lower("company_name"), c."deleted_at" NULLS FIRST, c."created_at"
ON CONFLICT (lower(btrim("name"))) WHERE "deleted_at" IS NULL DO NOTHING;
--> statement-breakpoint

UPDATE "clients" c
SET "company_id" = co."id"
FROM "companies" co
WHERE c."company_id" IS NULL
  AND co."deleted_at" IS NULL
  AND lower(btrim(co."name")) = lower(CASE WHEN btrim(c."name") = '' THEN 'Client ' || left(c."id"::text, 8)
       WHEN length(btrim(c."name")) <= 160 THEN btrim(c."name")
       ELSE left(btrim(c."name"), 149) || ' (' || left(c."id"::text, 8) || ')' END);
--> statement-breakpoint

-- 2a. Leads whose email matches an existing contact (ignoring case) link to
-- it. When several contacts match, a live one wins, then an exact-case
-- match, then the oldest.
UPDATE "leads" l
SET "contact_id" = m."id"
FROM (
  SELECT DISTINCT ON (lower(btrim(le."contact_email")))
    lower(btrim(le."contact_email")) AS "email_key",
    ct."id"
  FROM "leads" le
  JOIN "contacts" ct ON lower(ct."email") = lower(btrim(le."contact_email"))
  WHERE le."contact_id" IS NULL
    AND btrim(coalesce(le."contact_email", '')) <> ''
  ORDER BY
    lower(btrim(le."contact_email")),
    ct."deleted_at" NULLS FIRST,
    (ct."email" = btrim(le."contact_email")) DESC,
    ct."created_at"
) m
WHERE l."contact_id" IS NULL
  AND lower(btrim(l."contact_email")) = m."email_key";
--> statement-breakpoint

-- 2b. One new contact per remaining email, named from that email's earliest
-- lead (leads sharing an email become one contact). A contact only archived
-- leads point to is created archived, so old leads don't crowd the pickers.
INSERT INTO "contacts" ("email", "name", "phone", "company_id", "created_at", "updated_at", "deleted_at")
SELECT DISTINCT ON (lower(btrim(l."contact_email")))
  lower(btrim(l."contact_email")),
  l."contact_name",
  nullif(btrim(coalesce(l."contact_phone", '')), ''),
  l."company_id",
  l."created_at",
  timezone('utc'::text, now()),
  (
    SELECT CASE WHEN bool_and(x."deleted_at" IS NOT NULL) THEN max(x."deleted_at") END
    FROM "leads" x
    WHERE lower(btrim(x."contact_email")) = lower(btrim(l."contact_email"))
  )
FROM "leads" l
WHERE l."contact_id" IS NULL
  AND btrim(coalesce(l."contact_email", '')) <> ''
ORDER BY lower(btrim(l."contact_email")), l."created_at"
ON CONFLICT ("email") DO NOTHING;
--> statement-breakpoint

UPDATE "leads" l
SET "contact_id" = ct."id"
FROM "contacts" ct
WHERE l."contact_id" IS NULL
  AND btrim(coalesce(l."contact_email", '')) <> ''
  AND ct."email" = lower(btrim(l."contact_email"));
--> statement-breakpoint

-- 2c. Leads with no email each get a name-only contact.
WITH "src" AS (
  SELECT
    l."id" AS "lead_id",
    gen_random_uuid() AS "contact_id",
    l."contact_name",
    nullif(btrim(coalesce(l."contact_phone", '')), '') AS "phone",
    l."company_id",
    l."created_at",
    l."deleted_at"
  FROM "leads" l
  WHERE l."contact_id" IS NULL
),
"created" AS (
  -- An archived lead's name-only contact is created archived too.
  INSERT INTO "contacts" ("id", "email", "name", "phone", "company_id", "created_at", "updated_at", "deleted_at")
  SELECT "contact_id", NULL, "contact_name", "phone", "company_id", "created_at", timezone('utc'::text, now()), "deleted_at"
  FROM "src"
  RETURNING "id"
)
UPDATE "leads" l
SET "contact_id" = s."contact_id"
FROM "src" s
WHERE l."id" = s."lead_id"
  AND s."contact_id" IN (SELECT "id" FROM "created");
--> statement-breakpoint

-- 2d. A live lead's contact is live: restore any archived contact matched
-- by email in 2a.
UPDATE "contacts" ct
SET "deleted_at" = NULL, "updated_at" = timezone('utc'::text, now())
WHERE ct."deleted_at" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "leads" l
    WHERE l."contact_id" = ct."id" AND l."deleted_at" IS NULL
  );
--> statement-breakpoint

-- Keep the many-to-many link table in step with the new column.
INSERT INTO "contact_leads" ("contact_id", "lead_id")
SELECT l."contact_id", l."id"
FROM "leads" l
WHERE l."contact_id" IS NOT NULL
ON CONFLICT ("contact_id", "lead_id") DO NOTHING;
--> statement-breakpoint

-- 3a. Contacts without a company take their most recent lead's company.
UPDATE "contacts" ct
SET "company_id" = x."company_id"
FROM (
  SELECT DISTINCT ON (l."contact_id") l."contact_id", l."company_id"
  FROM "leads" l
  WHERE l."contact_id" IS NOT NULL AND l."company_id" IS NOT NULL
  ORDER BY l."contact_id", l."deleted_at" NULLS FIRST, l."updated_at" DESC
) x
WHERE ct."id" = x."contact_id"
  AND ct."company_id" IS NULL;
--> statement-breakpoint

-- 3b. Then their client's company (their primary client first).
UPDATE "contacts" ct
SET "company_id" = x."company_id"
FROM (
  SELECT DISTINCT ON (cc."contact_id") cc."contact_id", cl."company_id"
  FROM "contact_clients" cc
  JOIN "clients" cl ON cl."id" = cc."client_id"
  WHERE cl."company_id" IS NOT NULL
  ORDER BY cc."contact_id", cc."is_primary" DESC, cl."deleted_at" NULLS FIRST, cc."created_at"
) x
WHERE ct."id" = x."contact_id"
  AND ct."company_id" IS NULL;
--> statement-breakpoint

-- 4a. A company's champion becomes its primary contact.
UPDATE "companies" co
SET "primary_contact_id" = ct."id"
FROM "contacts" ct
WHERE co."primary_contact_id" IS NULL
  AND ct."company_id" = co."id"
  AND ct."is_champion"
  AND ct."deleted_at" IS NULL;
--> statement-breakpoint

-- 4b. Otherwise its client's primary contact (live clients first).
UPDATE "companies" co
SET "primary_contact_id" = x."contact_id"
FROM (
  SELECT DISTINCT ON (cl."company_id") cl."company_id", cc."contact_id"
  FROM "contact_clients" cc
  JOIN "clients" cl ON cl."id" = cc."client_id"
  JOIN "contacts" ct ON ct."id" = cc."contact_id" AND ct."deleted_at" IS NULL
  WHERE cc."is_primary" AND cl."company_id" IS NOT NULL
    -- Only someone who works there (or nowhere on record yet).
    AND (ct."company_id" IS NULL OR ct."company_id" = cl."company_id")
  ORDER BY cl."company_id", cl."deleted_at" NULLS FIRST, cc."created_at"
) x
WHERE co."id" = x."company_id"
  AND co."primary_contact_id" IS NULL;
