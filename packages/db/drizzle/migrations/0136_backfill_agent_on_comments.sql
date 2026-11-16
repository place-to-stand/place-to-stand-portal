-- Backfill agent_name (0135) from the activity log: every MCP write stamped
-- metadata.agent.name on its activity row. 'Unknown app' is the fallback when
-- the OAuth client name couldn't be read, so it is never copied.

-- Comments: the TASK_COMMENT_CREATED row points at the comment itself.
UPDATE "task_comments" AS c
SET "agent_name" = a."metadata" -> 'agent' ->> 'name'
FROM "activity_logs" AS a
WHERE a."verb" = 'TASK_COMMENT_CREATED'
  AND a."source" = 'MCP'
  AND a."target_type" = 'COMMENT'
  AND a."target_id" = c."id"
  AND c."agent_name" IS NULL
  AND coalesce(a."metadata" -> 'agent' ->> 'name', '') NOT IN ('', 'Unknown app');
--> statement-breakpoint
-- Lead updates: the LEAD_UPDATE_LOGGED row points at the lead, so match on
-- lead, author and the nearest time (the activity row is written right after
-- the insert), within 60 seconds.
UPDATE "lead_updates" AS u
SET "agent_name" = m."name"
FROM (
  SELECT DISTINCT ON (u2."id")
    u2."id",
    a."metadata" -> 'agent' ->> 'name' AS "name"
  FROM "lead_updates" AS u2
  JOIN "activity_logs" AS a
    ON a."verb" = 'LEAD_UPDATE_LOGGED'
    AND a."target_type" = 'LEAD'
    AND a."target_id" = u2."lead_id"
    AND a."actor_id" = u2."author_id"
    AND a."created_at" BETWEEN u2."created_at" - interval '5 seconds'
      AND u2."created_at" + interval '60 seconds'
  WHERE u2."agent_name" IS NULL
  ORDER BY u2."id", abs(extract(epoch FROM a."created_at" - u2."created_at"))
) AS m
WHERE u."id" = m."id"
  AND coalesce(m."name", '') NOT IN ('', 'Unknown app');
