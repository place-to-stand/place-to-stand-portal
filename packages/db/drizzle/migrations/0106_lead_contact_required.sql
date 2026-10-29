-- A lead is a person (and optionally their company): its name, email and
-- phone are read from its contact, its company's name from its company, so
-- every lead needs a contact and a typed company name needs a record. 0096 gave every
-- lead a contact; this stops (and lists them) if any lead still has none
-- rather than guessing. A contact with leads can no longer be hard-deleted
-- out from under them (archive it instead).
-- Leads that still only have a typed company name (0090 skipped archived
-- leads and long names) get a company record, so the name survives 0107
-- dropping the copy: an existing company with that name (live first), else
-- a new one, archived so it doesn't crowd the pickers.
INSERT INTO "companies" ("name", "created_at", "updated_at", "deleted_at")
SELECT DISTINCT ON (lower(btrim(l."company_name")))
  btrim(l."company_name"),
  l."created_at",
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
FROM "leads" l
WHERE l."company_id" IS NULL
  AND btrim(coalesce(l."company_name", '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "companies" co
    WHERE lower(btrim(co."name")) = lower(btrim(l."company_name"))
  )
ORDER BY lower(btrim(l."company_name")), l."created_at";
--> statement-breakpoint
UPDATE "leads" l
SET "company_id" = (
  SELECT co."id" FROM "companies" co
  WHERE lower(btrim(co."name")) = lower(btrim(l."company_name"))
  ORDER BY co."deleted_at" NULLS FIRST, co."created_at"
  LIMIT 1
)
WHERE l."company_id" IS NULL
  AND btrim(coalesce(l."company_name", '')) <> '';
--> statement-breakpoint
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(format('%s (%s)', l."id", l."contact_name"), E'\n')
    INTO missing
  FROM "leads" l
  WHERE l."contact_id" IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION E'These leads have no contact. Re-run 0096 or link them first:\n%', missing;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_contact_id_fkey";
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "contact_id" SET NOT NULL;
