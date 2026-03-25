DROP INDEX "idx_project_sows_project_active";--> statement-breakpoint
CREATE INDEX "idx_project_sows_project_active" ON "project_sows" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NULL);