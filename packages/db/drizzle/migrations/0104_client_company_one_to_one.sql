-- A company has one client. Stop (and list them) if any company has more
-- than one live client: those need a person to merge or unlink them first.
-- Nothing is merged automatically.
DO $$
DECLARE
  duplicates text;
BEGIN
  SELECT string_agg(
           format('%s: %s', co.name, x.client_names),
           E'\n'
         )
    INTO duplicates
  FROM (
    SELECT company_id, string_agg(name, ', ' ORDER BY name) AS client_names
    FROM clients
    WHERE deleted_at IS NULL AND company_id IS NOT NULL
    GROUP BY company_id
    HAVING count(*) > 1
  ) x
  JOIN companies co ON co.id = x.company_id;

  IF duplicates IS NOT NULL THEN
    RAISE EXCEPTION E'These companies have more than one live client. Merge or unlink them before this migration:\n%', duplicates;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_company_id_live_key" ON "clients" USING btree ("company_id") WHERE (deleted_at IS NULL AND company_id IS NOT NULL);
