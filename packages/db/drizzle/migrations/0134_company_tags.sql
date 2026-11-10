CREATE TYPE "public"."tag_entity" AS ENUM('company');--> statement-breakpoint
CREATE TABLE "company_tags" (
	"company_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_tags_pkey" PRIMARY KEY("company_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" "tag_entity" NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tags_name_not_blank" CHECK (btrim(name) <> '')
);
--> statement-breakpoint
ALTER TABLE "company_tags" ADD CONSTRAINT "company_tags_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_tags" ADD CONSTRAINT "company_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_tags" ADD CONSTRAINT "company_tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_company_tags_tag" ON "company_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tags_entity_name_unique" ON "tags" USING btree ("entity",lower(btrim(name))) WHERE (deleted_at IS NULL);