-- Drop orphaned table from earlier design (empty, not tracked by Drizzle)
DROP TABLE IF EXISTS "worker_deployments";
--> statement-breakpoint
CREATE TABLE "task_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"repo_link_id" uuid NOT NULL,
	"github_issue_number" integer NOT NULL,
	"github_issue_url" text NOT NULL,
	"worker_status" "worker_status" NOT NULL,
	"model" text,
	"mode" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_deployments" ADD CONSTRAINT "task_deployments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_deployments" ADD CONSTRAINT "task_deployments_repo_link_id_fkey" FOREIGN KEY ("repo_link_id") REFERENCES "public"."github_repo_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_deployments" ADD CONSTRAINT "task_deployments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_task_deployments_task" ON "task_deployments" USING btree ("task_id" uuid_ops);--> statement-breakpoint
-- Backfill: create deployment rows from tasks that already have a GitHub issue
INSERT INTO "task_deployments" ("task_id", "repo_link_id", "github_issue_number", "github_issue_url", "worker_status", "model", "mode", "created_by", "created_at", "updated_at")
SELECT
  t."id",
  (SELECT grl."id" FROM "github_repo_links" grl WHERE grl."project_id" = t."project_id" AND grl."deleted_at" IS NULL ORDER BY grl."created_at" ASC LIMIT 1),
  t."github_issue_number",
  t."github_issue_url",
  t."worker_status",
  'sonnet',
  'plan',
  COALESCE(t."created_by", (SELECT u."id" FROM "users" u WHERE u."role" = 'ADMIN' LIMIT 1)),
  COALESCE(t."updated_at", NOW()),
  COALESCE(t."updated_at", NOW())
FROM "tasks" t
WHERE t."github_issue_number" IS NOT NULL
  AND t."github_issue_url" IS NOT NULL
  AND t."worker_status" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "github_repo_links" grl WHERE grl."project_id" = t."project_id" AND grl."deleted_at" IS NULL);