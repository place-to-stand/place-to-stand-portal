-- Undo 0116 (portal access needs the Client role). Run in one transaction,
-- before 0115-undo:
--   psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f docs/migrations/0116-undo.sql
-- Puts back 0113's view (no role check) and removes the 0116 migration row.
CREATE OR REPLACE VIEW "client_portal_access" AS
  SELECT co.id AS company_id,
    m.contact_id,
    c.user_id
  FROM memberships m
    JOIN companies co ON co.id = m.company_id AND company_is_client(co.id)
    JOIN contacts c ON c.id = m.contact_id AND c.deleted_at IS NULL AND c.user_id IS NOT NULL
    JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL AND u.disabled_at IS NULL
  WHERE m.ended_at IS NULL AND m.portal_access;
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "id" = (SELECT max("id") FROM "drizzle"."__drizzle_migrations");
