-- Migration: contacts_name_required_add_phone
-- All operations wrapped in conditionals since contacts table may not exist yet

-- 1. Backfill NULL names with email prefix (before '@')
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts' AND table_schema = 'public') THEN
        UPDATE "contacts"
        SET "name" = split_part(email, '@', 1)
        WHERE "name" IS NULL;
    END IF;
END $$;--> statement-breakpoint

-- 2. Make name NOT NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts' AND table_schema = 'public') THEN
        ALTER TABLE "contacts" ALTER COLUMN "name" SET NOT NULL;
    END IF;
END $$;--> statement-breakpoint

-- 3. Add phone column (nullable)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts' AND table_schema = 'public') THEN
        ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "phone" text;
    END IF;
END $$;
