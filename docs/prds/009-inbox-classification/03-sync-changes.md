# 03: Sync Changes

> Part of [PRD 009: Inbox Classification & Triage](./README.md)
> Phase: **1 — Data Model & Sync Changes**
> Dependencies: [02-data-model.md](./02-data-model.md) (classification column must exist)

## Remove Auto-Linking from Gmail Sync

The Gmail sync in `lib/email/sync.ts` currently auto-links threads to leads when the sender email matches `leads.contactEmail` (via `matchThreadToLead()` → `linkThreadToLead()`). **This auto-linking must be removed.**

After this change, sync does one thing: **ingest messages into threads**. It does not write `clientId`, `projectId`, or `leadId`. All linking happens through:
- Triage mode (accept with link selection) — see [04-triage-mode.md](./04-triage-mode.md)
- Thread detail sheet (existing linking panels) — see [07-detail-sheet-and-lead-creation.md](./07-detail-sheet-and-lead-creation.md)

The deterministic matchers (`matchThreadToLead`, `matchAndLinkThread`) are refactored into read-only suggestion functions in Phase 3 (see [04-triage-mode.md §Detection Logic](./04-triage-mode.md#detection-logic--matcher-refactor)) and are no longer called from sync.

## Lead `lastContactAt` Update

The sync currently updates `leads.lastContactAt` when auto-linking. Since we're removing auto-linking, this update moves to the triage accept flow: when a thread is linked to a lead, update the lead's `lastContactAt` with the thread's `lastMessageAt`.

**Where this lives**: In the `PATCH /api/threads/[threadId]` handler, when `leadId` is being set to a non-null value.

## Implementation Checklist (Phase 1)

1. Remove `matchThreadToLead()` and `linkThreadToLead()` calls from `lib/email/sync.ts`
2. Remove the `leads.lastContactAt` update from sync
3. Add `leads.lastContactAt` update to the thread linking action (`PATCH /api/threads/[threadId]`) when `leadId` is set
4. Verify sync still correctly: creates threads, stores messages, sets `isRead`/`isInbound`, handles incremental sync
