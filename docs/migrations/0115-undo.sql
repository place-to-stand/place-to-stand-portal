-- Undo 0115 (function hardening). Run in one transaction, before 0114-undo:
--   psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f docs/migrations/0115-undo.sql
-- resolve_actor_role is not restored: nothing called it (restore it from the
-- release-day backup if it is ever needed).
GRANT EXECUTE ON FUNCTION "public"."company_billed_in"(uuid, date) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."company_billing_open"(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."company_is_client"(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."company_was_client"(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."company_client_since"(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."company_billing_ends_on"(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."company_billing_ended_at"(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."user_role_as_of"(uuid, date) TO PUBLIC;
CREATE TRIGGER "activity_logs_set_updated_at" BEFORE UPDATE ON "public"."activity_logs" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "id" = (SELECT max("id") FROM "drizzle"."__drizzle_migrations");
