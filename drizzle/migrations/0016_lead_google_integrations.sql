ALTER TABLE "leads" ADD COLUMN "google_meetings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "google_proposals" jsonb DEFAULT '[]'::jsonb NOT NULL;