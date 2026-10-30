-- Client state lives in client_billing_periods (0113). Archive the old pair
-- first, so the undo is exact.
CREATE TABLE "archive_sales_tools"."company_client_dates_0114" AS
  SELECT id, client_since, client_ended_at FROM "companies" WHERE client_since IS NOT NULL;--> statement-breakpoint
DROP INDEX "idx_companies_client";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "client_since";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "client_ended_at";