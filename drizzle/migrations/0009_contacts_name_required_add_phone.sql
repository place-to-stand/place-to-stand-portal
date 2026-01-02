-- Migration: contacts_name_required_add_phone
-- 1. Backfill NULL names with email prefix (before '@')
UPDATE "contacts"
SET "name" = split_part(email, '@', 1)
WHERE "name" IS NULL;

--> statement-breakpoint

-- 2. Make name NOT NULL
ALTER TABLE "contacts" ALTER COLUMN "name" SET NOT NULL;

--> statement-breakpoint

-- 3. Add phone column (nullable)
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "phone" text;
