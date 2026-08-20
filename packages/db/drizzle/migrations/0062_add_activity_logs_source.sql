CREATE TYPE "public"."activity_source" AS ENUM('ADMIN_UI', 'CLI', 'SYSTEM');--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "actor_role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD COLUMN "source" "activity_source" DEFAULT 'ADMIN_UI' NOT NULL;