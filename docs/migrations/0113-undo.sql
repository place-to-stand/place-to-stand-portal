-- Undo 0113 (billing periods, role terms, the staff flag, RESTRICT keys).
-- Run in one transaction, after 0114-undo:
--   psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f docs/migrations/0113-undo.sql
-- Client state goes back to companies.client_since / client_ended_at (put
-- back by 0114-undo); the role history and billing periods are dropped
-- (users.role keeps today's role).
CREATE OR REPLACE VIEW "client_portal_access" AS
  SELECT co.id AS company_id,
    m.contact_id,
    c.user_id
  FROM memberships m
    JOIN companies co ON co.id = m.company_id AND co.client_since IS NOT NULL AND co.client_ended_at IS NULL AND co.deleted_at IS NULL
    JOIN contacts c ON c.id = m.contact_id AND c.deleted_at IS NULL AND c.user_id IS NOT NULL
    JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL AND u.disabled_at IS NULL
  WHERE m.ended_at IS NULL AND m.portal_access;
DROP FUNCTION "company_is_client"(uuid);
DROP FUNCTION "company_billing_open"(uuid);
DROP FUNCTION "company_billed_in"(uuid, date);
ALTER TABLE "activity_logs" DISABLE TRIGGER USER;
UPDATE "activity_logs" l SET "target_type" = 'CLIENT'
  FROM "archive_sales_tools"."client_activity_0113" a WHERE a."id" = l."id";
-- Billing events logged since the release sit on the company too.
UPDATE "activity_logs" SET "target_type" = 'CLIENT'
  WHERE "target_type" = 'COMPANY'
    AND "verb" IN ('CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_ARCHIVED', 'CLIENT_RESTORED', 'CLIENT_DELETED');
ALTER TABLE "activity_logs" ENABLE TRIGGER USER;
DROP TABLE "archive_sales_tools"."client_activity_0113";
ALTER TABLE "time_logs" DROP CONSTRAINT "time_logs_user_id_fkey";
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "task_comments" DROP CONSTRAINT "task_comments_author_id_fkey";
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "hour_blocks" DROP CONSTRAINT "hour_blocks_company_id_fkey";
ALTER TABLE "hour_blocks" ADD CONSTRAINT "hour_blocks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_updates" DROP CONSTRAINT "client_updates_company_id_fkey";
ALTER TABLE "client_updates" ADD CONSTRAINT "client_updates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
DROP INDEX "uq_companies_staff";
ALTER TABLE "companies" DROP COLUMN "is_staff";
DROP TABLE "user_role_terms";
DROP TABLE "client_billing_periods";
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "id" = (SELECT max("id") FROM "drizzle"."__drizzle_migrations");
