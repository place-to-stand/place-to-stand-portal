CREATE TYPE "public"."lead_loss_reason" AS ENUM('BUDGET', 'TIMING', 'COMPETITOR', 'FIT', 'GHOSTED', 'OTHER');--> statement-breakpoint
CREATE TABLE "lead_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"from_status" "lead_status",
	"to_status" "lead_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"changed_by" uuid
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "loss_reason" "lead_loss_reason";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "loss_notes" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "current_stage_entered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lead_stage_history_lead" ON "lead_stage_history" USING btree ("lead_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_lead_stage_history_changed_at" ON "lead_stage_history" USING btree ("changed_at");--> statement-breakpoint
UPDATE "leads" SET "current_stage_entered_at" = "updated_at" WHERE "current_stage_entered_at" IS NULL;--> statement-breakpoint
INSERT INTO "lead_stage_history" ("lead_id", "from_status", "to_status", "changed_at")
SELECT "id", NULL, "status", "created_at" FROM "leads" WHERE "deleted_at" IS NULL;