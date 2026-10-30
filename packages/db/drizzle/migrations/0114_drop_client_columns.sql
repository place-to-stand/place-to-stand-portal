DROP INDEX "idx_companies_client";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "client_since";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "client_ended_at";