-- A task has one assignee. Tasks that still list several (set through the
-- CLI/MCP, which used to accept a list) keep the person assigned first;
-- the others are soft-deleted (deleted_at), like any unassignment, so the
-- history stays. Idempotent: safe to run twice.
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
