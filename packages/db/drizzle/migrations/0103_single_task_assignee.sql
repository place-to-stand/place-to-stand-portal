-- A task has one assignee. Tasks that still list several (set through the
-- CLI/MCP, which used to accept a list) keep the person assigned first;
-- the others are soft-deleted (deleted_at), like any unassignment, so the
-- history stays. Then a partial unique index makes "one current assignee
-- per task" a rule the database keeps (syncAssignees soft-deletes the old
-- row before inserting the new one, so a reassignment never trips it).
-- The dedupe is idempotent; the CREATE INDEX is DDL and runs once.
UPDATE "task_assignees" AS ta
SET "deleted_at" = now()
FROM (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "task_id"
           ORDER BY "created_at", "id"
         ) AS "position"
  FROM "task_assignees"
  WHERE "deleted_at" IS NULL
) AS ranked
WHERE ta."id" = ranked."id"
  AND ranked."position" > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "task_assignees_one_current_per_task" ON "task_assignees" USING btree ("task_id") WHERE (deleted_at IS NULL);
