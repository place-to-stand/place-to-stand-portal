-- A one-off data fix for the original installation: it backfilled one
-- month's partner profit share onto that month's close, before the portal
-- tracked profit share. It has already run where it was needed, and touches
-- no schema, so it is a no-op here. Kept so migration numbering stays intact.
SELECT 1;
