-- Portal access needs a live Client sign-in (security review, Nov 2026).
-- The view checked the portal flag and a live sign-in but not the role, so
-- a staff sign-in (Admin, Sales) left with a membership's portal_access on
-- would still be let into the client portal, though both sheets show it
-- locked. The database now enforces the same rule the app does
-- (hasLiveClientSignIn): role CLIENT, not switched off or archived.
CREATE OR REPLACE VIEW "client_portal_access" AS
  SELECT co.id AS company_id,
    m.contact_id,
    c.user_id
  FROM memberships m
    JOIN companies co ON co.id = m.company_id AND company_is_client(co.id)
    JOIN contacts c ON c.id = m.contact_id AND c.deleted_at IS NULL AND c.user_id IS NOT NULL
    JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL AND u.disabled_at IS NULL
      AND u.role = 'CLIENT'
  WHERE m.ended_at IS NULL AND m.portal_access;
