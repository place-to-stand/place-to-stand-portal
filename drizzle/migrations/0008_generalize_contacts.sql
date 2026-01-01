-- =============================================================================
-- 0008_generalize_contacts.sql
-- Generalize contacts table for multi-entity relationships
-- Changes:
--   1. Create contact_clients junction table
--   2. Create contact_leads junction table
--   3. Migrate data from client_contacts to junction table
--   4. Rename client_contacts to contacts
--   5. Drop old columns and constraints
--   6. Update suggestion_status enum (remove EXPIRED)
--   7. Create project_status enum and convert projects.status column
--   8. Disable RLS and drop all policies on ALL tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create contact_clients junction table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "contact_clients" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "contact_id" uuid NOT NULL,
    "client_id" uuid NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT "contact_clients_contact_client_key" UNIQUE("contact_id","client_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contact_clients_contact" ON "contact_clients" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contact_clients_client" ON "contact_clients" USING btree ("client_id");--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Step 2: Create contact_leads junction table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "contact_leads" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "contact_id" uuid NOT NULL,
    "lead_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT "contact_leads_contact_lead_key" UNIQUE("contact_id","lead_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contact_leads_contact" ON "contact_leads" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contact_leads_lead" ON "contact_leads" USING btree ("lead_id");--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Step 3: Migrate data from client_contacts to contact_clients junction table
-- (Handles case where table may have already been renamed in a previous attempt)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    -- Try to migrate from client_contacts (original table name)
    INSERT INTO "contact_clients" (contact_id, client_id, is_primary, created_at)
    SELECT id, client_id, is_primary, created_at
    FROM "client_contacts"
    WHERE client_id IS NOT NULL
    ON CONFLICT (contact_id, client_id) DO NOTHING;
EXCEPTION
    WHEN undefined_table THEN
        -- Table was already renamed to contacts, check if we need to migrate
        -- (client_id column might already be dropped too)
        NULL;
END $$;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Step 4: Rename client_contacts to contacts
-- (All renames wrapped in exception handlers for idempotency)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    ALTER TABLE "client_contacts" RENAME TO "contacts";
EXCEPTION
    WHEN undefined_table THEN NULL; -- Already renamed
END $$;--> statement-breakpoint

-- Rename the constraints and indexes (Postgres keeps old names after rename)
DO $$
BEGIN
    ALTER INDEX "client_contacts_pkey" RENAME TO "contacts_pkey";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER INDEX "client_contacts_client_email_key" RENAME TO "contacts_email_key_old";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER INDEX "idx_client_contacts_client" RENAME TO "idx_contacts_client_old";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER INDEX "idx_client_contacts_email" RENAME TO "idx_contacts_email";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER INDEX "idx_client_contacts_email_domain" RENAME TO "idx_contacts_email_domain";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint

-- Rename foreign key constraints
DO $$
BEGIN
    ALTER TABLE "contacts" RENAME CONSTRAINT "client_contacts_client_id_fkey" TO "contacts_client_id_fkey_old";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint

DO $$
BEGIN
    ALTER TABLE "contacts" RENAME CONSTRAINT "client_contacts_created_by_fkey" TO "contacts_created_by_fkey";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Step 5: Add foreign keys for junction tables
-- (After rename so we can reference the contacts table)
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
    ALTER TABLE "contact_clients" ADD CONSTRAINT "contact_clients_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
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

DO $$
BEGIN
    ALTER TABLE "contact_leads" ADD CONSTRAINT "contact_leads_lead_id_fkey"
        FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Step 6: Drop old columns from contacts table
-- First we must disable RLS and drop policies that depend on client_id
-- -----------------------------------------------------------------------------

-- Disable RLS and drop policies on contacts BEFORE dropping client_id column
ALTER TABLE "contacts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage client contacts" ON "contacts";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view client contacts for accessible clients" ON "contacts";--> statement-breakpoint

-- Now drop the old FK constraint
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_client_id_fkey_old";--> statement-breakpoint

-- Drop the old index that referenced client_id
DROP INDEX IF EXISTS "idx_contacts_client_old";--> statement-breakpoint

-- Drop the old unique constraint (client_id, email combo no longer applies)
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_email_key_old";--> statement-breakpoint

-- Add new unique constraint on just email
DO $$
BEGIN
    ALTER TABLE "contacts" ADD CONSTRAINT "contacts_email_key" UNIQUE("email");
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Drop the columns (data already migrated to junction table)
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "client_id";--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "is_primary";--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Step 7: Update suggestion_status enum (remove EXPIRED)
-- Uses add-column/copy/drop/rename pattern to avoid ALTER COLUMN TYPE issues
-- -----------------------------------------------------------------------------

DO $$
DECLARE
    has_expired boolean;
    has_status_new_col boolean;
BEGIN
    -- Check if the current enum still has EXPIRED value
    SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'suggestion_status'
        AND e.enumlabel = 'EXPIRED'
    ) INTO has_expired;

    -- Check if we have a temporary column from a previous partial run
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'suggestions' AND column_name = 'status_new'
    ) INTO has_status_new_col;

    -- Only proceed if we still need to remove EXPIRED
    IF has_expired THEN
        -- Create the new enum type (without EXPIRED)
        DROP TYPE IF EXISTS "public"."suggestion_status_v2";
        CREATE TYPE "public"."suggestion_status_v2" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'MODIFIED', 'FAILED');

        -- Add new column with new enum type
        IF NOT has_status_new_col THEN
            ALTER TABLE "suggestions" ADD COLUMN "status_new" "suggestion_status_v2";
        END IF;

        -- Copy data from old column to new (cast through text)
        UPDATE "suggestions" SET "status_new" = status::text::"suggestion_status_v2";

        -- Drop the old column
        ALTER TABLE "suggestions" DROP COLUMN "status";

        -- Rename new column to status
        ALTER TABLE "suggestions" RENAME COLUMN "status_new" TO "status";

        -- Set NOT NULL and default
        ALTER TABLE "suggestions" ALTER COLUMN "status" SET NOT NULL;
        ALTER TABLE "suggestions" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"suggestion_status_v2";

        -- Drop the old enum
        DROP TYPE "public"."suggestion_status";

        -- Rename new enum to original name
        ALTER TYPE "public"."suggestion_status_v2" RENAME TO "suggestion_status";

        RAISE NOTICE 'Successfully updated suggestion_status enum (removed EXPIRED)';
    ELSIF has_status_new_col THEN
        -- Cleanup from partial run: finish the rename
        ALTER TABLE "suggestions" DROP COLUMN IF EXISTS "status";
        ALTER TABLE "suggestions" RENAME COLUMN "status_new" TO "status";
        ALTER TABLE "suggestions" ALTER COLUMN "status" SET NOT NULL;
        ALTER TABLE "suggestions" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"suggestion_status_v2";
        DROP TYPE IF EXISTS "public"."suggestion_status";
        ALTER TYPE "public"."suggestion_status_v2" RENAME TO "suggestion_status";
        RAISE NOTICE 'Completed partial migration of suggestion_status';
    ELSE
        RAISE NOTICE 'suggestion_status enum already updated (EXPIRED not found)';
    END IF;
END $$;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Step 8: Create project_status enum and convert column
-- -----------------------------------------------------------------------------

-- Create the new enum (wrapped for idempotency)
DO $$
BEGIN
    CREATE TYPE "public"."project_status" AS ENUM('ONBOARDING', 'ACTIVE', 'ON_HOLD', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Drop the existing default first (text 'active' cannot auto-cast to enum)
-- This is safe to run even if there's no default
DO $$
BEGIN
    ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT;
EXCEPTION
    WHEN others THEN NULL;
END $$;--> statement-breakpoint

-- Convert existing text values to enum (mapping 'active' -> 'ACTIVE')
-- Skip if already converted to project_status enum
DO $$
BEGIN
    -- Check if column is still text type before converting
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects'
        AND column_name = 'status'
        AND data_type = 'text'
    ) THEN
        ALTER TABLE "projects" ALTER COLUMN "status" TYPE "project_status"
            USING (CASE
                WHEN status = 'active' THEN 'ACTIVE'::project_status
                WHEN status = 'onboarding' THEN 'ONBOARDING'::project_status
                WHEN status = 'on_hold' THEN 'ON_HOLD'::project_status
                WHEN status = 'completed' THEN 'COMPLETED'::project_status
                ELSE 'ACTIVE'::project_status
            END);
    END IF;
END $$;--> statement-breakpoint

-- Set the new default (safe to run even if already set)
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"project_status";--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Step 9: Disable RLS and drop ALL policies on ALL tables
-- (This project does not use RLS - access control is handled in application layer)
-- -----------------------------------------------------------------------------

-- Tables from 0000_supabase_baseline
ALTER TABLE "activity_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins delete activity logs" ON "activity_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins update activity logs" ON "activity_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "Users insert activity logs" ON "activity_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view activity logs" ON "activity_logs";--> statement-breakpoint

ALTER TABLE "activity_overview_cache" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Users can delete their cached activity overview" ON "activity_overview_cache";--> statement-breakpoint
DROP POLICY IF EXISTS "Users can insert their cached activity overview" ON "activity_overview_cache";--> statement-breakpoint
DROP POLICY IF EXISTS "Users can update their cached activity overview" ON "activity_overview_cache";--> statement-breakpoint
DROP POLICY IF EXISTS "Users can view their cached activity overview" ON "activity_overview_cache";--> statement-breakpoint

ALTER TABLE "client_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins delete client members" ON "client_members";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins insert client members" ON "client_members";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins update client members" ON "client_members";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view client members" ON "client_members";--> statement-breakpoint

ALTER TABLE "clients" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins delete clients" ON "clients";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins insert clients" ON "clients";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins update clients" ON "clients";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view clients" ON "clients";--> statement-breakpoint

ALTER TABLE "hour_blocks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins delete hour blocks" ON "hour_blocks";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins insert hour blocks" ON "hour_blocks";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins update hour blocks" ON "hour_blocks";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view hour blocks" ON "hour_blocks";--> statement-breakpoint

ALTER TABLE "projects" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins delete projects" ON "projects";--> statement-breakpoint
DROP POLICY IF EXISTS "Users create projects" ON "projects";--> statement-breakpoint
DROP POLICY IF EXISTS "Users update projects" ON "projects";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view projects" ON "projects";--> statement-breakpoint

ALTER TABLE "task_assignees" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage task assignees" ON "task_assignees";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view task assignees" ON "task_assignees";--> statement-breakpoint

ALTER TABLE "task_attachments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage task attachments" ON "task_attachments";--> statement-breakpoint
DROP POLICY IF EXISTS "Users create task attachments" ON "task_attachments";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view task attachments" ON "task_attachments";--> statement-breakpoint

ALTER TABLE "task_comments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage task comments" ON "task_comments";--> statement-breakpoint
DROP POLICY IF EXISTS "Users create task comments" ON "task_comments";--> statement-breakpoint
DROP POLICY IF EXISTS "Users update task comments" ON "task_comments";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view task comments" ON "task_comments";--> statement-breakpoint

ALTER TABLE "tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Users create tasks" ON "tasks";--> statement-breakpoint
DROP POLICY IF EXISTS "Users delete tasks" ON "tasks";--> statement-breakpoint
DROP POLICY IF EXISTS "Users update tasks" ON "tasks";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view tasks" ON "tasks";--> statement-breakpoint

ALTER TABLE "time_log_tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage time log tasks" ON "time_log_tasks";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view time log tasks" ON "time_log_tasks";--> statement-breakpoint

ALTER TABLE "time_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage time logs" ON "time_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "Users update time logs" ON "time_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view time logs" ON "time_logs";--> statement-breakpoint

ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins delete users" ON "users";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins insert users" ON "users";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins update users" ON "users";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view accessible users" ON "users";--> statement-breakpoint

-- Tables from 0002_crm-phase-1 (leads and task_assignee_metadata don't have RLS enabled, but have policies)
DROP POLICY IF EXISTS "Admins manage leads" ON "leads";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view leads" ON "leads";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage task assignee metadata" ON "task_assignee_metadata";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view task assignee metadata" ON "task_assignee_metadata";--> statement-breakpoint

-- Tables from 0007_unified_messaging
-- (contacts already handled in Step 6 above)

ALTER TABLE "oauth_connections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Users manage own oauth connections" ON "oauth_connections";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins view all oauth connections" ON "oauth_connections";--> statement-breakpoint

ALTER TABLE "threads" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage threads" ON "threads";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view accessible threads" ON "threads";--> statement-breakpoint

ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Users manage own messages" ON "messages";--> statement-breakpoint
DROP POLICY IF EXISTS "Admins view all messages" ON "messages";--> statement-breakpoint

ALTER TABLE "github_repo_links" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage github repo links" ON "github_repo_links";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view repo links for accessible projects" ON "github_repo_links";--> statement-breakpoint

ALTER TABLE "suggestions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage suggestions" ON "suggestions";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view suggestions for accessible threads" ON "suggestions";--> statement-breakpoint

ALTER TABLE "suggestion_feedback" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Admins manage suggestion feedback" ON "suggestion_feedback";--> statement-breakpoint
DROP POLICY IF EXISTS "Users view own suggestion feedback" ON "suggestion_feedback";--> statement-breakpoint
DROP POLICY IF EXISTS "Users create own suggestion feedback" ON "suggestion_feedback";--> statement-breakpoint

-- Now that all policies are dropped, we can drop the is_admin() function and view
DROP VIEW IF EXISTS "public"."current_user_with_role";--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."is_admin"();
