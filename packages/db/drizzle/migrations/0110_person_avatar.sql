-- A photo belongs to the person, not their sign-in: contacts get avatar_url,
-- filled from their sign-in's photo. users.avatar_url stays (kept in step on
-- every change) until the sign-in table is slimmed down.
ALTER TABLE "contacts" ADD COLUMN "avatar_url" text;--> statement-breakpoint
UPDATE "contacts" c
SET "avatar_url" = u."avatar_url"
FROM "users" u
WHERE c."user_id" = u."id" AND u."avatar_url" IS NOT NULL;
