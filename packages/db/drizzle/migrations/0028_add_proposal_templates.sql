CREATE TYPE "public"."proposal_template_type" AS ENUM('TERMS_AND_CONDITIONS');--> statement-breakpoint
CREATE TABLE "proposal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "proposal_template_type" NOT NULL,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_proposal_templates_type" ON "proposal_templates" USING btree ("type") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_proposal_templates_default" ON "proposal_templates" USING btree ("type") WHERE (deleted_at IS NULL AND is_default = true);