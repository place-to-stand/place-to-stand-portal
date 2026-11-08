ALTER TABLE "leads" DROP COLUMN "last_contact_at";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "awaiting_reply";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "expected_close_date";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "loss_reason";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "loss_notes";--> statement-breakpoint
DROP TYPE "public"."lead_loss_reason";