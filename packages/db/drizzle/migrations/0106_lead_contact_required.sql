-- A lead is a person (and optionally their company): its name, email and
-- phone are read from its contact, so every lead needs one. 0096 gave every
-- lead a contact; this stops (and lists them) if any lead still has none
-- rather than guessing. A contact with leads can no longer be hard-deleted
-- out from under them (archive it instead).
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
