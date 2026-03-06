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

Phase 4: AI Classification                       ← depends on Phase 1
├── 05-ai-classification.md
└── Requires: transcripts table exists

Phase 5: Inbox UI                                ← depends on Phases 1, 2, 4
├── 04-transcript-triage.md
└── Requires: table + sync + AI analysis all in place
```

**Parallelization**: Phase 3 can run alongside everything else. Phases 2 and 4 can run in parallel after Phase 1. Phase 5 requires 1, 2, and 4 complete.

## Resolved Decisions

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Transcript access model | **Global** (shared across all admins) | Only 3 owners, no sensitivity concerns. Transcripts are shared context by nature. One sync discovers, all can classify. |
| Data model approach | **New `transcripts` table** (not threads, not meetings) | Different metadata (participants, duration, meeting date) and access patterns (global vs per-user). Keeps email model clean. |
| Discovery method | **Broad Google Drive search** | Catches transcripts from meetings not scheduled through the portal. More reliable than Meet API chain which requires conferenceId. |
| AI result caching | **Store in record fields** (`aiSuggested*` columns) | Analyze once, cache forever. No separate cache table. `aiAnalyzedAt` null = needs analysis. Idempotent analyze endpoint. |
| Lead auto-linking | **Remove now** | Replace the opaque LINK_EMAIL_THREAD and LINK_TRANSCRIPT suggestions with explicit inbox triage. All classification is user-approved. |
| Classification invariant | **Same as threads** (PRD 009) | CLASSIFIED = has link. Dismiss clears links. Mutual exclusivity: lead ↔ client/project. |
| Sync trigger | **Cron + manual** | Cron runs on interval (like Gmail sync). Manual trigger from inbox UI. Dedup by driveFileId. |
| Multi-user sync dedup | **driveFileId unique constraint** | If user A syncs a doc, user B's sync sees it already exists and skips. Natural dedup. |
