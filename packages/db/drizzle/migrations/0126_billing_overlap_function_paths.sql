-- Portal audit, Nov 2026 (DB-4, DB-8, DB-9). Drizzle can't express these, so
-- schema.ts only notes them.

-- DB-8: a company's billing periods never overlap. The app only appends
-- after the latest period; this stops a hand-made fix from breaking that.
-- Prod had no overlapping rows when this was written.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;--> statement-breakpoint
ALTER TABLE "client_billing_periods" ADD CONSTRAINT "excl_client_billing_periods_overlap"
  EXCLUDE USING gist (
    company_id WITH =,
    daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') WITH &&
  ) WHERE (deleted_at IS NULL);--> statement-breakpoint

-- DB-9: pin search_path on the SQL helpers (Supabase advisor
-- function_search_path_mutable). None of them is inlined, so plans don't
-- change.
ALTER FUNCTION "company_billed_in"(uuid, date) SET search_path = public;--> statement-breakpoint
ALTER FUNCTION "company_billing_open"(uuid) SET search_path = public;--> statement-breakpoint
ALTER FUNCTION "company_is_client"(uuid) SET search_path = public;--> statement-breakpoint
ALTER FUNCTION "company_was_client"(uuid) SET search_path = public;--> statement-breakpoint
ALTER FUNCTION "company_client_since"(uuid) SET search_path = public;--> statement-breakpoint
ALTER FUNCTION "company_billing_ends_on"(uuid) SET search_path = public;--> statement-breakpoint
ALTER FUNCTION "company_billing_ended_at"(uuid) SET search_path = public;--> statement-breakpoint
ALTER FUNCTION "user_role_as_of"(uuid, date) SET search_path = public;--> statement-breakpoint
ALTER FUNCTION "billing_type_as_of"(uuid, date) SET search_path = public;--> statement-breakpoint
ALTER FUNCTION "commission_term_as_of"(uuid, date) SET search_path = public;--> statement-breakpoint

-- DB-4: portal access reads the role in force from user_role_terms (the
-- record), not the users.role copy the daily cron keeps in step. A sign-in
-- with no term falls back to users.role.
CREATE OR REPLACE VIEW "client_portal_access" AS
  SELECT co.id AS company_id,
    m.contact_id,
    c.user_id
  FROM memberships m
    JOIN companies co ON co.id = m.company_id AND company_is_client(co.id)
    JOIN contacts c ON c.id = m.contact_id AND c.deleted_at IS NULL AND c.user_id IS NOT NULL
    JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL AND u.disabled_at IS NULL
      AND coalesce(user_role_as_of(u.id, timezone('utc', now())::date), u.role) = 'CLIENT'
  WHERE m.ended_at IS NULL AND m.portal_access;
