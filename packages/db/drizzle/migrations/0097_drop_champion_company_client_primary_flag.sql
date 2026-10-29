ALTER TABLE "companies" DROP CONSTRAINT "companies_client_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_contacts_one_champion";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "client_id";--> statement-breakpoint
ALTER TABLE "contact_clients" DROP COLUMN "is_primary";--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN "is_champion";