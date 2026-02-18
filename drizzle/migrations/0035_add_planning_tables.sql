CREATE TYPE "public"."planning_session_status" AS ENUM('active', 'deployed');--> statement-breakpoint
CREATE TABLE "plan_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	CONSTRAINT "plan_revisions_thread_version_key" UNIQUE("thread_id","version")
);
--> statement-breakpoint
CREATE TABLE "plan_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"model" text NOT NULL,
	"model_label" text NOT NULL,
	"current_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"repo_link_id" uuid NOT NULL,
	"status" "planning_session_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_messages" ADD CONSTRAINT "plan_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."plan_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_revisions" ADD CONSTRAINT "plan_revisions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."plan_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_threads" ADD CONSTRAINT "plan_threads_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."planning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_sessions" ADD CONSTRAINT "planning_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_sessions" ADD CONSTRAINT "planning_sessions_repo_link_id_fkey" FOREIGN KEY ("repo_link_id") REFERENCES "public"."github_repo_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_sessions" ADD CONSTRAINT "planning_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_plan_messages_thread" ON "plan_messages" USING btree ("thread_id" uuid_ops,"created_at");--> statement-breakpoint
CREATE INDEX "idx_plan_revisions_thread" ON "plan_revisions" USING btree ("thread_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_plan_threads_session" ON "plan_threads" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_planning_sessions_task" ON "planning_sessions" USING btree ("task_id" uuid_ops);