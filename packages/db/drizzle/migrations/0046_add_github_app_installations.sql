CREATE TYPE "public"."github_app_installation_status" AS ENUM('ACTIVE', 'SUSPENDED', 'REMOVED');--> statement-breakpoint
CREATE TABLE "github_app_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"installed_by_user_id" uuid NOT NULL,
	"installation_id" bigint NOT NULL,
	"account_login" text NOT NULL,
	"account_id" bigint NOT NULL,
	"account_type" text NOT NULL,
	"account_avatar_url" text,
	"repository_selection" text NOT NULL,
	"status" "github_app_installation_status" DEFAULT 'ACTIVE' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"events" text[] DEFAULT '{}' NOT NULL,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "github_app_installations_installation_id_key" UNIQUE("installation_id")
);
--> statement-breakpoint
DROP INDEX "idx_github_repo_links_oauth";--> statement-breakpoint
ALTER TABLE "github_repo_links" ALTER COLUMN "oauth_connection_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "github_repo_links" ADD COLUMN "github_app_installation_id" uuid;--> statement-breakpoint
ALTER TABLE "github_app_installations" ADD CONSTRAINT "github_app_installations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_app_installations" ADD CONSTRAINT "github_app_installations_installed_by_user_id_fkey" FOREIGN KEY ("installed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_github_app_installations_client" ON "github_app_installations" USING btree ("client_id" uuid_ops) WHERE (deleted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_github_app_installations_status" ON "github_app_installations" USING btree ("status") WHERE (deleted_at IS NULL);--> statement-breakpoint
ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_github_app_installation_id_fkey" FOREIGN KEY ("github_app_installation_id") REFERENCES "public"."github_app_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_github_repo_links_installation" ON "github_repo_links" USING btree ("github_app_installation_id" uuid_ops) WHERE (deleted_at IS NULL AND github_app_installation_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_github_repo_links_oauth" ON "github_repo_links" USING btree ("oauth_connection_id" uuid_ops) WHERE (deleted_at IS NULL AND oauth_connection_id IS NOT NULL);--> statement-breakpoint
ALTER TABLE "github_repo_links" ADD CONSTRAINT "github_repo_links_auth_source_check" CHECK ((
        (oauth_connection_id IS NOT NULL AND github_app_installation_id IS NULL)
        OR (oauth_connection_id IS NULL AND github_app_installation_id IS NOT NULL)
      ));