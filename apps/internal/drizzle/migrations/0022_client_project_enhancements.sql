ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "website" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "referred_by" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "owner_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_owner_id_fkey') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_referred_by_fkey') THEN
    ALTER TABLE "clients" ADD CONSTRAINT "clients_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clients_referred_by" ON "clients" USING btree ("referred_by" uuid_ops) WHERE (deleted_at IS NULL AND referred_by IS NOT NULL);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_owner" ON "projects" USING btree ("owner_id" uuid_ops) WHERE (deleted_at IS NULL AND owner_id IS NOT NULL);
