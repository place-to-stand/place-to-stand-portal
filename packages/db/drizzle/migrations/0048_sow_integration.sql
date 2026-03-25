CREATE TYPE "public"."scope_planning_session_status" AS ENUM('active', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."sow_snapshot_status" AS ENUM('CURRENT', 'SUPERSEDED');--> statement-breakpoint
CREATE TABLE "project_sows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"google_doc_id" text NOT NULL,
	"google_doc_url" text NOT NULL,
	"google_doc_title" text,
	"linked_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scope_planning_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sow_id" uuid NOT NULL,
	"repo_link_id" uuid NOT NULL,
	"snapshot_id" uuid,
	"status" "scope_planning_session_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
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
ALTER TABLE "plan_threads" ALTER COLUMN "session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_threads" ADD COLUMN "scope_session_id" uuid;--> statement-breakpoint
ALTER TABLE "project_sows" ADD CONSTRAINT "project_sows_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sows" ADD CONSTRAINT "project_sows_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_planning_sessions" ADD CONSTRAINT "scope_planning_sessions_sow_id_fkey" FOREIGN KEY ("sow_id") REFERENCES "public"."project_sows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_planning_sessions" ADD CONSTRAINT "scope_planning_sessions_repo_link_id_fkey" FOREIGN KEY ("repo_link_id") REFERENCES "public"."github_repo_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_planning_sessions" ADD CONSTRAINT "scope_planning_sessions_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."sow_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_planning_sessions" ADD CONSTRAINT "scope_planning_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sow_sections" ADD CONSTRAINT "sow_sections_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."sow_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sow_sections" ADD CONSTRAINT "sow_sections_sow_id_fkey" FOREIGN KEY ("sow_id") REFERENCES "public"."project_sows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sow_snapshots" ADD CONSTRAINT "sow_snapshots_sow_id_fkey" FOREIGN KEY ("sow_id") REFERENCES "public"."project_sows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sow_snapshots" ADD CONSTRAINT "sow_snapshots_snapped_by_fkey" FOREIGN KEY ("snapped_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_project_sows_project_active" ON "project_sows" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_project_sows_google_doc" ON "project_sows" USING btree ("google_doc_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_scope_planning_sessions_sow" ON "scope_planning_sessions" USING btree ("sow_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sow_sections_snapshot" ON "sow_sections" USING btree ("snapshot_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sow_sections_sow" ON "sow_sections" USING btree ("sow_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sow_snapshots_sow" ON "sow_snapshots" USING btree ("sow_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "plan_threads" ADD CONSTRAINT "plan_threads_scope_session_id_fkey" FOREIGN KEY ("scope_session_id") REFERENCES "public"."scope_planning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_plan_threads_scope_session" ON "plan_threads" USING btree ("scope_session_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "plan_threads" ADD CONSTRAINT "plan_threads_session_xor_scope" CHECK ((session_id IS NOT NULL AND scope_session_id IS NULL) OR (session_id IS NULL AND scope_session_id IS NOT NULL));