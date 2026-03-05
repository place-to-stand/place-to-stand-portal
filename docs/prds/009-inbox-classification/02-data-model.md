# 02: Data Model Changes

> Part of [PRD 009: Inbox Classification & Triage](./README.md)
> Phase: **1 — Data Model & Sync Changes**
> Dependencies: None — start here

## Thread Classification Enum

Add a new `thread_classification` enum and column to the `threads` table.

```sql
CREATE TYPE thread_classification AS ENUM (
  'UNCLASSIFIED',
  'CLASSIFIED',
  'DISMISSED'
);

ALTER TABLE threads
  ADD COLUMN classification thread_classification NOT NULL DEFAULT 'UNCLASSIFIED';
```

**Definitions:**
- `UNCLASSIFIED` — Default. Thread has not been reviewed. All existing threads start here.
- `CLASSIFIED` — Thread has been reviewed and linked to a client, project, or lead. Set automatically when any link is established.
- `DISMISSED` — User explicitly dismissed. The thread has no business value (notifications, promotions, irrelevant correspondence).

**Invariant**: `CLASSIFIED` threads always have at least one link (`clientId`, `projectId`, or `leadId` is non-NULL). This invariant is enforced by the behaviors below.

> **Why only three states?** We considered `INFORMATIONAL` and `AUTOMATED` but cut them for v1. The core question is binary: "Does this thread belong to something in our system, or not?" If it does → link it (CLASSIFIED). If it doesn't → dismiss it. A middle ground adds decision fatigue to the triage flow without clear value.

## Triage Activity Tracking

Add fields to track who classified each thread and when.

```sql
ALTER TABLE threads
  ADD COLUMN classified_by UUID REFERENCES users(id),
  ADD COLUMN classified_at TIMESTAMPTZ;
```

## Migration Strategy

All existing threads get `classification = 'UNCLASSIFIED'` (the column default). This means the full inbox history is available for triage. Users can work through their backlog at their own pace.

Threads that are already linked to a client, project, or lead should be backfilled to `CLASSIFIED` via a data migration. `classified_by` is left NULL for backfilled rows — NULL `classified_by` with a non-NULL `classified_at` indicates a system backfill.

```sql
UPDATE threads
SET classification = 'CLASSIFIED',
    classified_at = now()
WHERE (client_id IS NOT NULL OR project_id IS NOT NULL OR lead_id IS NOT NULL)
  AND classification = 'UNCLASSIFIED';
```

## Indexes

```sql
CREATE INDEX idx_threads_classification ON threads (classification);
```

> `classified_by` does not need an index — there's no planned query pattern that filters by who classified a thread.

## Behavioral Rules

These rules maintain the `CLASSIFIED = linked` invariant across all operations.

### Auto-Classify on Link

When a user links a thread to a client, project, or lead — OR when a suggestion is approved — automatically set:
- `classification` → `CLASSIFIED`
- `classified_by` → current user
- `classified_at` → now()

This happens in the existing linking actions (server actions for thread linking). No separate classification step needed — **linking IS classifying**.

### Revert on Unlink

When a user **unlinks** a thread (sets `clientId`, `projectId`, or `leadId` to NULL via the existing `PATCH /api/threads/[threadId]` endpoint):
- If the thread has **no remaining links** (all three are NULL after the unlink), revert `classification` → `UNCLASSIFIED` and clear `classified_by` and `classified_at`
- If the thread still has at least one link, classification stays `CLASSIFIED`

This prevents orphaned `CLASSIFIED` threads with no actual links.

### Dismiss Unlinks

When a user reclassifies a thread to `DISMISSED` (from the detail sheet or triage mode):
- Remove all links: set `clientId`, `projectId`, and `leadId` to NULL
- Set `classification` → `DISMISSED`, `classified_by` → current user, `classified_at` → now()

This preserves the invariant: `CLASSIFIED` threads always have links, `DISMISSED` threads never do.

## Implementation Checklist (Phase 1)

1. Add `thread_classification` enum and column to `threads` (Drizzle schema + migration)
2. Add `classified_by` and `classified_at` columns (same migration)
3. Add `idx_threads_classification` index
4. Run backfill: existing linked threads → `CLASSIFIED` (with `classified_by = NULL`)
5. Update `PATCH /api/threads/[threadId]` to:
   - Auto-set `CLASSIFIED` on link
   - Revert to `UNCLASSIFIED` on full unlink
   - Remove all links when dismissing
6. Update suggestion approval to auto-set `CLASSIFIED`
