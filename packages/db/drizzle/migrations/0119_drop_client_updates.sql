-- Client updates were removed from the app (PR #286): never used, one
-- unsent draft in production. Run only after that code is live, since the
-- earlier release reads this table. Jason approved dropping the data.
DELETE FROM "activity_logs" WHERE "target_type" = 'CLIENT_UPDATE';--> statement-breakpoint
DROP TABLE "client_updates";--> statement-breakpoint
DROP TYPE "public"."client_update_status";
