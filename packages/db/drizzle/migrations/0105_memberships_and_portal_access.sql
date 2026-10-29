-- Memberships: a person at a company, with their title there, whether they
-- are the company's primary contact and whether they can see its client in
-- the client portal. A person can belong to several companies; the oldest
-- current membership is their main one. Replaces contacts.company_id / job_title,
-- companies.primary_contact_id, contact_clients and client_members, which
-- 0107 archives and drops once this has been backfilled from them.
-- Idempotent: safe to run twice (backfills skip people already placed).
CREATE TABLE IF NOT EXISTS "memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contact_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "title" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "portal_access" boolean DEFAULT false NOT NULL,
  "started_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "ended_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "memberships_ended_has_no_flags"
    CHECK (ended_at IS NULL OR (NOT is_primary AND NOT portal_access)),
  CONSTRAINT "memberships_contact_id_fkey" FOREIGN KEY ("contact_id")
    REFERENCES "contacts"("id") ON DELETE CASCADE,
  CONSTRAINT "memberships_company_id_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_one_current_per_contact_company"
  ON "memberships" ("contact_id", "company_id") WHERE (ended_at IS NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memberships_contact_current"
  ON "memberships" ("contact_id") WHERE (ended_at IS NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_one_primary_per_company"
  ON "memberships" ("company_id") WHERE (is_primary AND ended_at IS NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memberships_company_current"
  ON "memberships" ("company_id") WHERE (ended_at IS NULL);
--> statement-breakpoint

-- 1. Everyone at a company today. They are its primary contact if the
-- company says so. Portal access carries over only where it was real: a
-- portal login (client_members) for that company's client. contact_clients
-- was a CRM link (who belongs to a client), not access, so it only makes
-- the membership (step 2), never switches access on. Archived clients count
-- too, so restoring one later brings its people's access back. Archived
-- contacts start with access off, as archiving a contact does now.
INSERT INTO "memberships" ("contact_id", "company_id", "title", "is_primary", "portal_access", "started_at", "created_at", "updated_at")
SELECT
  c."id",
  c."company_id",
  nullif(btrim(coalesce(c."job_title", '')), ''),
  coalesce(co."primary_contact_id" = c."id", false),
  EXISTS (
    SELECT 1 FROM "client_members" cm
    JOIN "clients" cl ON cl."id" = cm."client_id"
    WHERE c."user_id" IS NOT NULL
      AND c."deleted_at" IS NULL
      AND cm."user_id" = c."user_id"
      AND cm."deleted_at" IS NULL
      AND cl."company_id" = c."company_id"
  ),
  c."created_at",
  c."created_at",
  timezone('utc'::text, now())
FROM "contacts" c
JOIN "companies" co ON co."id" = c."company_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "memberships" m
  WHERE m."contact_id" = c."id" AND m."company_id" = c."company_id"
    AND m."ended_at" IS NULL
);
--> statement-breakpoint

-- 2. Every other tie to a company becomes a membership there too, so no
-- link is lost: a contact linked to a company's client (contact_clients,
-- no access), a portal login for that client (client_members, access), or
-- being named a company's primary contact without working there. These
-- start now, so the person's own company (step 1) stays their main one.
-- The pre-release check lists the ones added here for review.
WITH "ties" AS (
  SELECT cc."contact_id", cl."company_id", false AS "access"
  FROM "contact_clients" cc
  JOIN "clients" cl ON cl."id" = cc."client_id"
  WHERE cl."company_id" IS NOT NULL
  UNION ALL
  SELECT c."id", cl."company_id", c."deleted_at" IS NULL
  FROM "client_members" cm
  JOIN "contacts" c ON c."user_id" = cm."user_id"
  JOIN "clients" cl ON cl."id" = cm."client_id"
  WHERE cm."deleted_at" IS NULL
    AND cl."company_id" IS NOT NULL
  UNION ALL
  SELECT co."primary_contact_id", co."id", false
  FROM "companies" co
  WHERE co."primary_contact_id" IS NOT NULL
),
"missing" AS (
  SELECT t."contact_id", t."company_id", bool_or(t."access") AS "access"
  FROM "ties" t
  WHERE NOT EXISTS (
    SELECT 1 FROM "memberships" m
    WHERE m."contact_id" = t."contact_id" AND m."company_id" = t."company_id"
      AND m."ended_at" IS NULL
  )
  GROUP BY t."contact_id", t."company_id"
)
INSERT INTO "memberships" ("contact_id", "company_id", "title", "is_primary", "portal_access", "started_at", "created_at", "updated_at")
SELECT
  mi."contact_id",
  mi."company_id",
  CASE WHEN c."company_id" IS NULL
    THEN nullif(btrim(coalesce(c."job_title", '')), '') END,
  coalesce(co."primary_contact_id" = mi."contact_id", false),
  mi."access",
  CASE WHEN c."company_id" IS NULL THEN c."created_at"
    ELSE timezone('utc'::text, now()) END,
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
FROM "missing" mi
JOIN "contacts" c ON c."id" = mi."contact_id"
JOIN "companies" co ON co."id" = mi."company_id";
--> statement-breakpoint

-- 3. Who can see which client in the client portal: one source, derived.
-- Access needs a portal login, so a membership without one never counts.
CREATE OR REPLACE VIEW "client_portal_access" AS
SELECT cl."id" AS "client_id", m."contact_id", c."user_id"
FROM "memberships" m
JOIN "clients" cl ON cl."company_id" = m."company_id" AND cl."deleted_at" IS NULL
JOIN "contacts" c ON c."id" = m."contact_id" AND c."deleted_at" IS NULL
  AND c."user_id" IS NOT NULL
WHERE m."ended_at" IS NULL AND m."portal_access";
