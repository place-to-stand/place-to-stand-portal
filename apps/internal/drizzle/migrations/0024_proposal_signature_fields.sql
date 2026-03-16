ALTER TABLE "proposals" ADD COLUMN "signer_name" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "signer_email" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "signature_data" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "signer_ip_address" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "signature_consent" boolean;