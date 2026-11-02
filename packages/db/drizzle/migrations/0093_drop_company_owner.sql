ALTER TABLE "companies" DROP CONSTRAINT "companies_owner_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_companies_owner";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "owner_id";