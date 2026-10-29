-- Archive what this drops (see docs/migrations/sales-tools-rollout.md):
-- nothing is thrown away, 0107 archives the rest into the same schema.
CREATE SCHEMA IF NOT EXISTS "archive_sales_tools";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "archive_sales_tools"."contact_clients_is_primary" AS
  SELECT "id", "contact_id", "client_id", "is_primary" FROM "contact_clients";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "archive_sales_tools"."contacts_is_champion" AS
  SELECT "id" AS "contact_id", "is_champion" FROM "contacts" WHERE "is_champion";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "archive_sales_tools"."companies_client_id" AS
  SELECT "id" AS "company_id", "client_id" FROM "companies" WHERE "client_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" DROP CONSTRAINT "companies_client_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_contacts_one_champion";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "client_id";--> statement-breakpoint
ALTER TABLE "contact_clients" DROP COLUMN "is_primary";--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN "is_champion";