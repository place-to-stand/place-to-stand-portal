ALTER TABLE "leads" DROP COLUMN "source_type";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "source_detail";--> statement-breakpoint
DROP TYPE "public"."lead_source_type";