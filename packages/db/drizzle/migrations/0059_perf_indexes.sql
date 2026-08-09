CREATE INDEX "idx_clients_name" ON "clients" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_projects_name" ON "projects" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tasks_project_archived" ON "tasks" USING btree ("project_id" uuid_ops) WHERE (deleted_at IS NOT NULL);