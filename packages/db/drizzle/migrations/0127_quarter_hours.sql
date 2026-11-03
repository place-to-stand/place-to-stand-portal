ALTER TABLE "hour_blocks" DROP CONSTRAINT "chk_hour_blocks_hours_purchased";--> statement-breakpoint
ALTER TABLE "hour_blocks" ADD CONSTRAINT "chk_hour_blocks_hours_purchased" CHECK (hours_purchased > 0 AND hours_purchased % 0.25 = 0);--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "chk_invoice_line_items_hour_block_quarters" CHECK (NOT creates_hour_block OR quantity % 0.25 = 0);--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "chk_time_logs_hours_quarters" CHECK (hours % 0.25 = 0);