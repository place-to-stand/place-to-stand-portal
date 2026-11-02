-- Hardening (security audit, Oct 30). The app connects as the database
-- owner and calls nothing through PostgREST, so the Supabase API roles need
-- no access to these functions.
--
-- 1. A leftover SECURITY DEFINER helper (no code calls it; it returned any
--    user's role to anyone holding the public anon key).
DROP FUNCTION IF EXISTS "public"."resolve_actor_role"(uuid);--> statement-breakpoint
-- 2. The read helpers 0113 added: callable by the app (owner) only.
REVOKE EXECUTE ON FUNCTION "public"."company_billed_in"(uuid, date) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION "public"."company_billing_open"(uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION "public"."company_is_client"(uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION "public"."company_was_client"(uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION "public"."company_client_since"(uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION "public"."company_billing_ends_on"(uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION "public"."company_billing_ended_at"(uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION "public"."user_role_as_of"(uuid, date) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
-- 3. activity_logs has no updated_at (0076), so its updated_at trigger made
--    any UPDATE on the table fail.
DROP TRIGGER IF EXISTS "activity_logs_set_updated_at" ON "public"."activity_logs";
