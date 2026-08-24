CREATE TYPE "public"."agent_message_status" AS ENUM('streaming', 'complete', 'error');--> statement-breakpoint
CREATE TYPE "public"."agent_session_turn_status" AS ENUM('idle', 'streaming', 'error');--> statement-breakpoint
ALTER TABLE "agent_messages" ADD COLUMN "status" "agent_message_status" DEFAULT 'streaming' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "turn_status" "agent_session_turn_status" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "agent_messages" SET "status" = 'complete' WHERE "status" = 'streaming';