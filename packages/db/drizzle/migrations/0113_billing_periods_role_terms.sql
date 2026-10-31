CREATE TABLE "client_billing_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_client_billing_periods_months" CHECK (starts_on = date_trunc('month', starts_on)::date AND (ends_on IS NULL OR (ends_on = date_trunc('month', ends_on)::date AND ends_on >= starts_on)))
);
--> statement-breakpoint
CREATE TABLE "user_role_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"effective_from" date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_user_role_terms_month_start" CHECK (effective_from = date_trunc('month', effective_from)::date)
);
--> statement-breakpoint
ALTER TABLE "client_updates" DROP CONSTRAINT "client_updates_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "hour_blocks" DROP CONSTRAINT "hour_blocks_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "task_comments" DROP CONSTRAINT "task_comments_author_id_fkey";
--> statement-breakpoint
ALTER TABLE "time_logs" DROP CONSTRAINT "time_logs_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "is_staff" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "client_billing_periods" ADD CONSTRAINT "client_billing_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_billing_periods" ADD CONSTRAINT "client_billing_periods_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_terms" ADD CONSTRAINT "user_role_terms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_terms" ADD CONSTRAINT "user_role_terms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_billing_periods_company" ON "client_billing_periods" USING btree ("company_id","starts_on" DESC NULLS LAST) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_client_billing_periods_open" ON "client_billing_periods" USING btree ("company_id") WHERE (ends_on IS NULL AND deleted_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_role_terms_user_effective" ON "user_role_terms" USING btree ("user_id","effective_from") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_user_role_terms_resolution" ON "user_role_terms" USING btree ("user_id","effective_from" DESC NULLS LAST) WHERE (deleted_at IS NULL);--> statement-breakpoint
ALTER TABLE "client_updates" ADD CONSTRAINT "client_updates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hour_blocks" ADD CONSTRAINT "hour_blocks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_companies_staff" ON "companies" USING btree ("is_staff") WHERE is_staff;--> statement-breakpoint
-- Billing periods from the old since/ended pair. A period starts at the first
-- month anything was billed (hour blocks, client time, billing terms, or
-- client_since, whichever is earliest), so no month the close counted before
-- drops out; a former client's period ends in the month it stopped.
INSERT INTO "client_billing_periods" ("company_id", "starts_on", "ends_on", "created_at", "updated_at")
SELECT c.id, b.starts_on,
  CASE WHEN c.client_ended_at IS NULL THEN NULL
    ELSE greatest(date_trunc('month', c.client_ended_at AT TIME ZONE 'utc')::date, b.starts_on) END,
  c.client_since, coalesce(c.client_ended_at, c.client_since)
FROM "companies" c
CROSS JOIN LATERAL (
  SELECT date_trunc('month', least(
    (c.client_since AT TIME ZONE 'utc')::date,
    (SELECT min(h.billing_month) FROM "hour_blocks" h WHERE h.company_id = c.id),
    (SELECT min(t.logged_on) FROM "time_logs" t JOIN "projects" p ON p.id = t.project_id
      WHERE p.company_id = c.id AND p.type = 'CLIENT'),
    (SELECT min(bt.effective_from) FROM "billing_terms" bt WHERE bt.company_id = c.id AND bt.deleted_at IS NULL)
  ))::date AS starts_on
) b
WHERE c.client_since IS NOT NULL;--> statement-breakpoint
-- The one definition of client state. Billed in a month: a period covers it.
CREATE FUNCTION "company_billed_in"(p_company uuid, p_month date) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_billing_periods p
    WHERE p.company_id = p_company AND p.deleted_at IS NULL
      AND p.starts_on <= date_trunc('month', p_month)::date
      AND (p.ends_on IS NULL OR p.ends_on >= date_trunc('month', p_month)::date))
$$;--> statement-breakpoint
-- Billing open: it hasn't ended (it runs this month, or a restart is
-- scheduled), whether or not the company is archived.
CREATE FUNCTION "company_billing_open"(p_company uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_billing_periods p
    WHERE p.company_id = p_company AND p.deleted_at IS NULL
      AND (p.ends_on IS NULL OR p.ends_on >= date_trunc('month', timezone('utc', now()))::date))
$$;--> statement-breakpoint
-- A client now: billing open and the company not archived.
CREATE FUNCTION "company_is_client"(p_company uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT company_billing_open(p_company)
    AND EXISTS (SELECT 1 FROM companies c WHERE c.id = p_company AND c.deleted_at IS NULL)
$$;--> statement-breakpoint
-- Read helpers take the company or sign-in id as an argument, so no query
-- has to correlate a subquery with an outer column.
CREATE FUNCTION "company_was_client"(p_company uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM client_billing_periods p WHERE p.company_id = p_company AND p.deleted_at IS NULL)
$$;--> statement-breakpoint
CREATE FUNCTION "company_client_since"(p_company uuid) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT min(p.starts_on) FROM client_billing_periods p WHERE p.company_id = p_company AND p.deleted_at IS NULL
$$;--> statement-breakpoint
-- While billing is open: the last month it is billed (null = no stop set).
CREATE FUNCTION "company_billing_ends_on"(p_company uuid) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN company_billing_open(p_company) THEN (
    SELECT p.ends_on FROM client_billing_periods p
    WHERE p.company_id = p_company AND p.deleted_at IS NULL
    ORDER BY p.starts_on DESC LIMIT 1) END
$$;--> statement-breakpoint
-- Once billing has ended: the first month no longer billed.
CREATE FUNCTION "company_billing_ended_at"(p_company uuid) RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN company_billing_open(p_company) THEN NULL ELSE (
    SELECT (max(p.ends_on) + interval '1 month')::timestamptz FROM client_billing_periods p
    WHERE p.company_id = p_company AND p.deleted_at IS NULL
    HAVING bool_and(p.ends_on IS NOT NULL)) END
$$;--> statement-breakpoint
-- A sign-in's role in force for the month of p_month.
CREATE FUNCTION "user_role_as_of"(p_user uuid, p_month date) RETURNS user_role
LANGUAGE sql STABLE AS $$
  SELECT t.role FROM user_role_terms t
  WHERE t.user_id = p_user AND t.deleted_at IS NULL
    AND t.effective_from <= date_trunc('month', p_month)::date
  ORDER BY t.effective_from DESC LIMIT 1
$$;--> statement-breakpoint
-- The portal reads client state through the same definition.
CREATE OR REPLACE VIEW "client_portal_access" AS
  SELECT co.id AS company_id,
    m.contact_id,
    c.user_id
  FROM memberships m
    JOIN companies co ON co.id = m.company_id AND company_is_client(co.id)
    JOIN contacts c ON c.id = m.contact_id AND c.deleted_at IS NULL AND c.user_id IS NOT NULL
    JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL AND u.disabled_at IS NULL
  WHERE m.ended_at IS NULL AND m.portal_access;--> statement-breakpoint
-- The staff company is marked, not found by name (its updated_at untouched).
ALTER TABLE "companies" DISABLE TRIGGER USER;--> statement-breakpoint
UPDATE "companies" SET "is_staff" = true
WHERE id = (SELECT id FROM "companies" WHERE lower(btrim(name)) = 'place to stand' AND deleted_at IS NULL
  ORDER BY created_at LIMIT 1);--> statement-breakpoint
ALTER TABLE "companies" ENABLE TRIGGER USER;--> statement-breakpoint
-- Everyone's role in force since Oct 2025 (the first month the close covers).
INSERT INTO "user_role_terms" ("user_id", "role", "effective_from")
SELECT id, role, DATE '2025-10-01' FROM "users";
--> statement-breakpoint
-- Billing events sit on the company: a client is a company you bill. The ids
-- are kept so the undo can put them back.
CREATE TABLE "archive_sales_tools"."client_activity_0113" AS
  SELECT id FROM "activity_logs" WHERE target_type = 'CLIENT';--> statement-breakpoint
ALTER TABLE "activity_logs" DISABLE TRIGGER USER;--> statement-breakpoint
UPDATE "activity_logs" SET target_type = 'COMPANY' WHERE target_type = 'CLIENT';--> statement-breakpoint
ALTER TABLE "activity_logs" ENABLE TRIGGER USER;
