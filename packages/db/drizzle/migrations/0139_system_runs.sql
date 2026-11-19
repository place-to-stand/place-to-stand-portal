CREATE TABLE "system_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"outcome" text NOT NULL,
	"detail" text,
	"ref" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_system_runs_kind_name_created" ON "system_runs" USING btree ("kind" text_ops,"name" text_ops,"created_at" timestamptz_ops);