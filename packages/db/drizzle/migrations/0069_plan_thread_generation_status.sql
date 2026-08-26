CREATE TYPE "public"."plan_thread_generation_status" AS ENUM('idle', 'streaming', 'error');--> statement-breakpoint
ALTER TABLE "plan_threads" ADD COLUMN "generation_status" "plan_thread_generation_status" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_threads" ADD COLUMN "generating_version" integer;--> statement-breakpoint
ALTER TABLE "plan_threads" ADD COLUMN "partial_content" text;--> statement-breakpoint
ALTER TABLE "plan_threads" ADD COLUMN "generation_error" text;