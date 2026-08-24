CREATE TYPE "public"."agent_proposed_task_status" AS ENUM('proposed', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."agent_session_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."agent_session_task_source" AS ENUM('proposal', 'selected');--> statement-breakpoint
ALTER TYPE "public"."activity_source" ADD VALUE 'AI_AGENT';--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_proposed_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "agent_proposed_task_status" DEFAULT 'proposed' NOT NULL,
	"project_id" uuid,
	"source_message_id" uuid,
	"created_task_id" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "agent_session_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"added_via" "agent_session_task_source" NOT NULL,
	"added_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	CONSTRAINT "agent_session_tasks_session_task_key" UNIQUE("session_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"status" "agent_session_status" DEFAULT 'active' NOT NULL,
	"title" text,
	"project_id" uuid,
	"repo_link_id" uuid,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_proposed_tasks" ADD CONSTRAINT "agent_proposed_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_proposed_tasks" ADD CONSTRAINT "agent_proposed_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_proposed_tasks" ADD CONSTRAINT "agent_proposed_tasks_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "public"."agent_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_proposed_tasks" ADD CONSTRAINT "agent_proposed_tasks_created_task_id_fkey" FOREIGN KEY ("created_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_proposed_tasks" ADD CONSTRAINT "agent_proposed_tasks_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_session_tasks" ADD CONSTRAINT "agent_session_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_session_tasks" ADD CONSTRAINT "agent_session_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_repo_link_id_fkey" FOREIGN KEY ("repo_link_id") REFERENCES "public"."github_repo_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_messages_session" ON "agent_messages" USING btree ("session_id" uuid_ops,"created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_proposed_tasks_session" ON "agent_proposed_tasks" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_agent_session_tasks_session" ON "agent_session_tasks" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_agent_sessions_created_by" ON "agent_sessions" USING btree ("created_by" uuid_ops);