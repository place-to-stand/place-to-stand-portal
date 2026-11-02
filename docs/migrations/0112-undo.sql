-- Undo 0112 (thin sign-in). Run in one transaction:
--   psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f docs/migrations/0112-undo.sql
-- Puts users.avatar_url back: each sign-in gets its person's photo (which
-- includes every photo it had; 0112 only ever copied onto the person).
ALTER TABLE "users" ADD COLUMN "avatar_url" text;
ALTER TABLE "users" DISABLE TRIGGER USER;
UPDATE "users" u SET "avatar_url" = COALESCE(c."avatar_url", a."avatar_url")
  FROM "users" u2
  LEFT JOIN "contacts" c ON c."user_id" = u2."id" AND c."deleted_at" IS NULL
  LEFT JOIN "archive_sales_tools"."user_avatars_0112" a ON a."id" = u2."id"
  WHERE u."id" = u2."id" AND (c."avatar_url" IS NOT NULL OR a."avatar_url" IS NOT NULL);
ALTER TABLE "users" ENABLE TRIGGER USER;
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "id" = (SELECT max("id") FROM "drizzle"."__drizzle_migrations");
DROP TABLE "archive_sales_tools"."user_avatars_0112";
