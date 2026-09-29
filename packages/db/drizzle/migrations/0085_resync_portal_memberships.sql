-- One-off repair. Until Sep 2026, linking or unlinking a client from the
-- contact sheet (and linking an existing contact during lead conversion)
-- wrote contact_clients without syncing client_members, so a promoted
-- contact's real portal access drifted from what the admin "preview as
-- contact" showed. New link changes now sync; this realigns existing rows.

-- Grant: a promoted contact linked to a live client gets a live membership.
INSERT INTO "client_members" ("client_id", "user_id")
SELECT cc."client_id", ct."user_id"
FROM "contact_clients" cc
JOIN "contacts" ct
  ON ct."id" = cc."contact_id"
  AND ct."deleted_at" IS NULL
  AND ct."user_id" IS NOT NULL
JOIN "clients" cl
  ON cl."id" = cc."client_id"
  AND cl."deleted_at" IS NULL
ON CONFLICT ("client_id", "user_id") DO UPDATE
  SET "deleted_at" = NULL
  WHERE "client_members"."deleted_at" IS NOT NULL;
--> statement-breakpoint

-- Revoke: a live membership for a promoted contact's user whose contact is no
-- longer linked to that client (an unlink that never reached client_members).
UPDATE "client_members" cm
SET "deleted_at" = timezone('utc'::text, now())
FROM "contacts" ct
WHERE ct."user_id" = cm."user_id"
  AND ct."deleted_at" IS NULL
  AND cm."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "contact_clients" cc
    WHERE cc."contact_id" = ct."id"
      AND cc."client_id" = cm."client_id"
  );
