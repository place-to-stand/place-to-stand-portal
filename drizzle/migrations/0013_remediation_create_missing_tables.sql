-- =============================================================================
-- 0013_remediation_create_missing_tables.sql
-- Creates all missing tables that should have been created by migration 0007
-- but were skipped because production database was in a different state.
-- Tables are created in their final state (after all subsequent migrations).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS (create if not exist)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    CREATE TYPE "public"."oauth_provider" AS ENUM('GOOGLE', 'GITHUB');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    CREATE TYPE "public"."oauth_connection_status" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING_REAUTH');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    CREATE TYPE "public"."message_source" AS ENUM('EMAIL', 'CHAT', 'VOICE_MEMO', 'DOCUMENT', 'FORM');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    CREATE TYPE "public"."thread_status" AS ENUM('OPEN', 'RESOLVED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    CREATE TYPE "public"."suggestion_type" AS ENUM('TASK', 'PR', 'REPLY');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- suggestion_status without EXPIRED (was removed in migration 0008)
DO $$
BEGIN
    CREATE TYPE "public"."suggestion_status" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'MODIFIED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- OAUTH CONNECTIONS (with sync_state from migration 0011)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "oauth_connections" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "provider" "oauth_provider" NOT NULL,
    "provider_account_id" text NOT NULL,
    "access_token" text NOT NULL,
    "refresh_token" text,
    "access_token_expires_at" timestamp with time zone,
    "scopes" text[] NOT NULL,
    "status" "oauth_connection_status" DEFAULT 'ACTIVE' NOT NULL,
    "provider_email" text,
    "display_name" text,
    "provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "sync_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "oauth_connections_user_provider_account_key" UNIQUE("user_id","provider","provider_account_id")
);--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_oauth_connections_user" ON "oauth_connections" USING btree ("user_id") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_oauth_connections_provider" ON "oauth_connections" USING btree ("provider") WHERE (deleted_at IS NULL AND status = 'ACTIVE');--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- CONTACTS (the table that was supposed to be renamed from client_contacts)
-- Final state after migrations 0008 and 0009
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "contacts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "name" text NOT NULL,
    "phone" text,
    "created_by" uuid,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "contacts_email_key" UNIQUE("email")
);--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_contacts_email" ON "contacts" USING btree ("email") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contacts_email_domain" ON "contacts" USING btree (split_part(email, '@', 2)) WHERE (deleted_at IS NULL);--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Add foreign keys from junction tables to contacts (created in migration 0008)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    ALTER TABLE "contact_clients" ADD CONSTRAINT "contact_clients_contact_id_fkey"
        FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "contact_leads" ADD CONSTRAINT "contact_leads_contact_id_fkey"
        FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- THREADS (conversation containers)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "threads" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "client_id" uuid,
    "project_id" uuid,
    "subject" text,
    "status" "thread_status" DEFAULT 'OPEN' NOT NULL,
    "source" "message_source" NOT NULL,
    "external_thread_id" text,
    "participant_emails" text[] DEFAULT '{}' NOT NULL,
    "last_message_at" timestamp with time zone,
    "message_count" integer DEFAULT 0 NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_by" uuid,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "deleted_at" timestamp with time zone
);--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "threads" ADD CONSTRAINT "threads_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "threads" ADD CONSTRAINT "threads_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "threads" ADD CONSTRAINT "threads_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_threads_client" ON "threads" USING btree ("client_id") WHERE (deleted_at IS NULL AND client_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_threads_project" ON "threads" USING btree ("project_id") WHERE (deleted_at IS NULL AND project_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_threads_external" ON "threads" USING btree ("external_thread_id") WHERE (deleted_at IS NULL AND external_thread_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_threads_last_message" ON "threads" USING btree ("last_message_at" DESC NULLS FIRST) WHERE (deleted_at IS NULL);--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- MESSAGES (individual messages within threads)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "thread_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "source" "message_source" NOT NULL,
    "external_message_id" text,
    "subject" text,
    "body_text" text,
    "body_html" text,
    "snippet" text,
    "from_email" text NOT NULL,
    "from_name" text,
    "to_emails" text[] DEFAULT '{}' NOT NULL,
    "cc_emails" text[] DEFAULT '{}' NOT NULL,
    "sent_at" timestamp with time zone NOT NULL,
    "is_inbound" boolean DEFAULT true NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "has_attachments" boolean DEFAULT false NOT NULL,
    "analyzed_at" timestamp with time zone,
    "analysis_version" text,
    "provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "messages_user_external_key" UNIQUE("user_id","external_message_id")
);--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_fkey"
        FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_messages_thread" ON "messages" USING btree ("thread_id") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_user" ON "messages" USING btree ("user_id") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_sent_at" ON "messages" USING btree ("sent_at" DESC NULLS FIRST) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_unanalyzed" ON "messages" USING btree ("user_id") WHERE (deleted_at IS NULL AND analyzed_at IS NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_from_email" ON "messages" USING btree ("from_email") WHERE (deleted_at IS NULL);--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- GITHUB REPO LINKS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "github_repo_links" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" uuid NOT NULL,
    "oauth_connection_id" uuid NOT NULL,
    "repo_owner" text NOT NULL,
    "repo_name" text NOT NULL,
    "repo_full_name" text NOT NULL,
    "repo_id" bigint NOT NULL,
    "default_branch" text DEFAULT 'main' NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "linked_by" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "github_repo_links_project_repo_key" UNIQUE("project_id","repo_full_name")
);--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_oauth_connection_id_fkey"
        FOREIGN KEY ("oauth_connection_id") REFERENCES "public"."oauth_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_linked_by_fkey"
        FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_github_repo_links_project" ON "github_repo_links" USING btree ("project_id") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_github_repo_links_repo" ON "github_repo_links" USING btree ("repo_full_name") WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_github_repo_links_oauth" ON "github_repo_links" USING btree ("oauth_connection_id") WHERE (deleted_at IS NULL);--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- SUGGESTIONS (without PR-related columns that were removed in migration 0012)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "suggestions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "message_id" uuid,
    "thread_id" uuid,
    "type" "suggestion_type" NOT NULL,
    "status" "suggestion_status" DEFAULT 'PENDING' NOT NULL,
    "project_id" uuid,
    "confidence" numeric(3, 2) NOT NULL,
    "reasoning" text,
    "ai_model_version" text,
    "prompt_tokens" integer,
    "completion_tokens" integer,
    "suggested_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "reviewed_by" uuid,
    "reviewed_at" timestamp with time zone,
    "created_task_id" uuid,
    "error_message" text,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "suggestions_confidence_range" CHECK (confidence >= 0 AND confidence <= 1)
);--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_message_id_fkey"
        FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_thread_id_fkey"
        FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_reviewed_by_fkey"
        FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_created_task_id_fkey"
        FOREIGN KEY ("created_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_suggestions_pending_type" ON "suggestions" USING btree ("type", "status") WHERE (deleted_at IS NULL AND status IN ('PENDING', 'DRAFT'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_suggestions_message" ON "suggestions" USING btree ("message_id") WHERE (deleted_at IS NULL AND message_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_suggestions_thread" ON "suggestions" USING btree ("thread_id") WHERE (deleted_at IS NULL AND thread_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_suggestions_project" ON "suggestions" USING btree ("project_id") WHERE (deleted_at IS NULL AND project_id IS NOT NULL);--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Apply remaining fixes from migration 0012 (tasks index)
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_tasks_due_on"
ON "tasks" USING btree ("due_on" ASC NULLS LAST)
WHERE (deleted_at IS NULL AND due_on IS NOT NULL);--> statement-breakpoint

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_id_fkey";
