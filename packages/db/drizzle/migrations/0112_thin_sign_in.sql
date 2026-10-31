-- 0112: a photo belongs to the person (contacts.avatar_url, since 0110), so
-- users is the sign-in only: id, email, role, disabled/deleted, onboarding.
-- Undo SQL: docs/migrations/sales-tools-rollout.md (0112).

CREATE TABLE "archive_sales_tools"."user_avatars_0112" AS
  SELECT "id", "avatar_url" FROM "users" WHERE "avatar_url" IS NOT NULL;--> statement-breakpoint

-- A photo only the sign-in has goes to its person (0110 copied them all;
-- this catches any set since by old code).
UPDATE "contacts" c SET "avatar_url" = u."avatar_url"
  FROM "users" u
  WHERE c."user_id" = u."id" AND c."deleted_at" IS NULL
    AND c."avatar_url" IS NULL AND u."avatar_url" IS NOT NULL;--> statement-breakpoint

-- Guard: stop before the drop if a photo would be lost (a sign-in with a
-- photo and no live person to carry it).
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(u."id"::text, ', ') INTO bad
  FROM "users" u
  WHERE u."avatar_url" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "contacts" c
      WHERE c."user_id" = u."id" AND c."deleted_at" IS NULL AND c."avatar_url" IS NOT NULL
    );
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '0112: sign-ins whose photo has no person to keep it: %', bad;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "users" DROP COLUMN "avatar_url";
