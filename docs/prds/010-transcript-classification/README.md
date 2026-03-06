---
title: '010: Transcript Classification & Triage'
status: 'draft'
author: 'Jason Desiderio'
date: '2026-03-06'
---

# 010: Transcript Classification & Triage

## Overview

Extend the context intake engine (PRD 009) to meeting transcripts. Discover all transcripts from Google Drive via broad search, present them in a new **Transcripts** tab in the inbox, and let admins classify them to clients/projects/leads using the same triage pattern as emails. Remove the existing "magic" lead auto-linking in favor of explicit human triage.

See [01-overview.md](./01-overview.md) for full problem statement, strategic shift, scope, and design principles.

## Documents

### Specification

| Document | Contents | Read when... |
|----------|----------|-------------|
| [01-overview.md](./01-overview.md) | Problem statement, strategic shift, scope, design principles | Starting the project or onboarding someone |
| [02-data-model.md](./02-data-model.md) | New transcripts table, enums, indexes, behavioral invariants | Working on Phase 1 (data model) |
| [03-drive-sync.md](./03-drive-sync.md) | Google Drive discovery, sync orchestrator, cron, dedup | Working on Phase 2 (sync) |
| [04-transcript-triage.md](./04-transcript-triage.md) | Inbox Transcripts tab, list views, classification panel UI | Working on Phase 5 (UI) |
| [05-ai-classification.md](./05-ai-classification.md) | AI analysis function, caching, analyze endpoint | Working on Phase 4 (AI) |
| [06-remove-lead-linking.md](./06-remove-lead-linking.md) | Delete auto-linking suggestions, files to remove/modify | Working on Phase 3 (cleanup) |
| [07-future-enhancements.md](./07-future-enhancements.md) | Calendar-based discovery, task suggestions, full-text search | Planning future work |
| [08-context-surfacing.md](./08-context-surfacing.md) | Transcript sections on client/lead pages, query layer | Working on Phase 5b (surfacing) |

### Tracking

| Document | Contents | Read when... |
|----------|----------|-------------|
| [PROGRESS.md](./PROGRESS.md) | Phase status, session log, key files modified | Starting a coding session |
| [TEST-PLAN.md](./TEST-PLAN.md) | Manual test cases by phase with pass/fail tracking | Testing after implementation |

## Implementation Phases & Dependencies

```
Phase 1: Data Model                              ← Start here
├── 02-data-model.md (schema, migration, invariants)
└── No dependencies

Phase 2: Drive Sync                              ← depends on Phase 1
├── 03-drive-sync.md (discovery, sync, cron)
└── Requires: transcripts table exists

Phase 3: Remove Lead Auto-Linking                ← independent
├── 06-remove-lead-linking.md
└── No dependencies — can run in parallel with any phase

Phase 4a: Transcript AI Classification             ← depends on Phase 1
├── 05-ai-classification.md (transcript classifier + caching)
└── Requires: transcripts table exists

Phase 4b: Email Classification Alignment           ← independent (refactor only)
├── 05-ai-classification.md (add leads to email prompt)
└── Test independently — touches production email triage

Phase 5: Inbox UI                                  ← depends on Phases 1, 2, 4a
├── 04-transcript-triage.md
└── Requires: table + sync + AI analysis all in place

Phase 5b: Context Surfacing                        ← depends on Phases 1, 5
├── 08-context-surfacing.md
└── Requires: transcripts table + query layer from Phase 5
```

**Parallelization**: Phase 3 can run alongside everything else. Phases 2, 4a, and 4b can run in parallel after Phase 1. Phase 5 requires 1, 2, and 4a complete. Phase 5b can ship with or immediately after Phase 5.

**Important**: Phase 4b (email classification alignment) is an explicit sub-task separated from 4a because it refactors a working production system. Test email classification independently before and after this change.

## Resolved Decisions

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Transcript access model | **Global** (shared across all admins) | Only 3 owners, no sensitivity concerns. Transcripts are shared context by nature. One sync discovers, all can classify. |
| Data model approach | **New `transcripts` table** (not threads, not meetings) | Different metadata (participants, duration, meeting date) and access patterns (global vs per-user). Keeps email model clean. |
| Discovery method | **Broad Google Drive search** | Catches transcripts from meetings not scheduled through the portal. More reliable than Meet API chain which requires conferenceId. |
| AI result caching | **Store in record fields** (`aiSuggested*` columns) | Analyze once, cache forever. No separate cache table. `aiAnalyzedAt` null = needs analysis. |
| Lead auto-linking | **Remove now** | Replace the opaque LINK_EMAIL_THREAD and LINK_TRANSCRIPT suggestions with explicit inbox triage. All classification is user-approved. |
| Classification invariant | **Same as threads** (PRD 009) | CLASSIFIED = has link. Dismiss clears links. Mutual exclusivity: lead ↔ client/project. |
| Sync trigger | **Cron + manual** | Cron runs every 15 minutes (same cadence as Gmail sync). Manual trigger from inbox UI. Dedup by driveFileId. |
| Multi-user sync dedup | **driveFileId unique constraint** | If user A syncs a doc, user B's sync sees it already exists and skips. Natural dedup. Sync state is per-connection (stored in existing `oauthConnections.syncState` JSONB). |
| Source enum | **Single value: `DRIVE_SEARCH`** | Ship minimal enum. Add `MEET_API` or `GEMINI_NOTES` via non-breaking migration when those discovery methods ship. |
| `meeting_id` FK | **Deferred** | No v1 logic correlates Drive docs to existing meeting records. Add when calendar-based discovery ships. |
| Analyze endpoint | **POST only** | POST for analyze (side-effecting), GET for reading cached results. Follows HTTP semantics. |
| Lead matching in AI | **Single-prompt for both flows** | Include leads directly in the AI classification prompt (alongside clients/projects). Align email classification to match. |
| Tab visibility | **Hidden for non-admins** | Transcripts tab not rendered in nav for CLIENT-role users. Don't show what you can't use. |
| Eager AI analysis | **On page load** | Triage/transcript pages eagerly fire analyze calls for unanalyzed items on load. Results are cached, so repeated loads are free. Non-blocking — UI renders immediately. |
| Triage sync scope | **Sync both** | From the Triage tab, the sync button triggers both email and transcript sync. Auto-sync interval does both too. |
| Activity logging | **Deferred** | Email classification doesn't log activity events today. Skip for transcripts too. Add for both in a future pass. |
| Legacy suggestion data | **No runtime guard** | Old LINK_EMAIL_THREAD / LINK_TRANSCRIPT rows in suggestions table are inert JSONB. The UI components are deleted; rows will never be queried. |
| Sync strategy | **Always dedup, no time filter** | Every sync fetches 50 most recent docs and deduplicates against DB. No `since` filter, no incremental mode. Simpler logic, trades slightly more API calls for zero edge cases. |
| DB vs AI lead matching | **Both coexist** | DB matchers (`suggestClientMatch`, `suggestLeadMatch`) remain on triage route for fast per-request matching. AI classification adds leads to its prompt separately. Different purposes, different speeds. |
| Auto-analyze | **Wired after Phase 4a** | Phase 2 ships without auto-analyze (avoids circular dependency). Follow-up PR wires `classifyTranscript()` into sync after Phase 4a delivers it. |
| Content in list queries | **Excluded** | `content` column (40-120KB/row) excluded from all list/summary queries. Only fetched in detail view. Architectural constraint. |
| Context surfacing | **Client pages + lead sheets** | Classified transcripts appear on client detail pages and lead sheet right column. Project-level surfacing deferred. |
| Search query management | **Configurable constants** | Drive search patterns stored as named constants with result count logging for drift detection. |
| Bulk dismiss | **By date** | "Dismiss older than..." action for clearing historical backlog on first onboarding. |
| Triage transcript sync | **Fire-and-forget, 5min interval** | Transcript sync from triage tab is non-blocking with 5-minute auto-interval (vs 60s for emails). Transcripts tab uses 60s interval. |
