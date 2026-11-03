-- Won leads whose company was already a client never got a conversion
-- date: only making the company a client stamped one. Mark them converted
-- as of the day they moved to Won. The app now stamps these itself.
UPDATE "leads"
SET "converted_at" = coalesce("current_stage_entered_at", "updated_at")
WHERE "status" = 'CLOSED_WON'
  AND "converted_at" IS NULL
  AND "deleted_at" IS NULL
  AND "company_id" IS NOT NULL
  AND company_was_client("company_id");
