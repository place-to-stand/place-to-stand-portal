CREATE TYPE "public"."sow_snapshot_status" AS ENUM('CURRENT', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."sow_status" AS ENUM('DRAFT', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'FINISHED');--> statement-breakpoint
CREATE TABLE "project_sows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"google_doc_id" text NOT NULL,
	"google_doc_url" text NOT NULL,
	"google_doc_title" text,
	"status" "sow_status" DEFAULT 'DRAFT' NOT NULL,
	"linked_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sow_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"sow_id" uuid NOT NULL,
	"heading_level" smallint NOT NULL,
	"heading_text" text NOT NULL,
	"body_text" text,
	"section_order" integer NOT NULL,
	"content_hash" text NOT NULL,
	"first_seen_in_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sow_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sow_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "sow_snapshot_status" DEFAULT 'CURRENT' NOT NULL,
	"raw_content" jsonb,
	"text_content" text,
	"doc_modified_at" timestamp with time zone,
	"snapped_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	CONSTRAINT "sow_snapshots_sow_version_key" UNIQUE("sow_id","version")
);
--> statement-breakpoint
ALTER TABLE "project_sows" ADD CONSTRAINT "project_sows_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sows" ADD CONSTRAINT "project_sows_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sow_sections" ADD CONSTRAINT "sow_sections_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."sow_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sow_sections" ADD CONSTRAINT "sow_sections_sow_id_fkey" FOREIGN KEY ("sow_id") REFERENCES "public"."project_sows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sow_snapshots" ADD CONSTRAINT "sow_snapshots_sow_id_fkey" FOREIGN KEY ("sow_id") REFERENCES "public"."project_sows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sow_snapshots" ADD CONSTRAINT "sow_snapshots_snapped_by_fkey" FOREIGN KEY ("snapped_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_sows_project_active" ON "project_sows" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_project_sows_google_doc" ON "project_sows" USING btree ("google_doc_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_sow_sections_snapshot" ON "sow_sections" USING btree ("snapshot_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sow_sections_sow" ON "sow_sections" USING btree ("sow_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sow_snapshots_sow" ON "sow_snapshots" USING btree ("sow_id" uuid_ops);