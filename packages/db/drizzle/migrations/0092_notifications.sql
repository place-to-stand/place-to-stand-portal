CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"actor_id" uuid,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"cleared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_feed" ON "notifications" USING btree ("user_id" uuid_ops,"created_at" timestamptz_ops) WHERE (cleared_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notifications_user_dedupe" ON "notifications" USING btree ("user_id" uuid_ops,"dedupe_key" text_ops) WHERE (dedupe_key IS NOT NULL);