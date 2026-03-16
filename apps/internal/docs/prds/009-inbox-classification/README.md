---
title: '009: Inbox Classification & Triage'
status: 'draft'
author: 'Jason Desiderio'
date: '2026-03-04'
---

# 009: Inbox Classification & Triage

## Overview

Reposition the inbox from "email client" to **context intake engine**. Every communication either belongs to a client/project/lead (→ link it) or is noise (→ dismiss it). The primary value: when a worker picks up a task, they see every related communication across all channels.

See [01-overview.md](./01-overview.md) for full problem statement, strategic shift, scope, and design principles.

## Documents

### Specification

| Document | Contents | Read when... |
|----------|----------|-------------|
| [01-overview.md](./01-overview.md) | Problem statement, strategic shift, scope, design principles, read-side payoff | Starting the project or onboarding someone |
| [02-data-model.md](./02-data-model.md) | Schema changes, enum, indexes, migration, classify/unlink/dismiss invariants | Working on Phase 1 (data model) |
| [03-sync-changes.md](./03-sync-changes.md) | Removing auto-linking from Gmail sync, lead lastContactAt move | Working on Phase 1 (sync) |
| [04-triage-mode.md](./04-triage-mode.md) | Triage UI, card layout, detection logic, matcher refactor, API endpoint, keyboard shortcuts | Working on Phase 3 (triage) |
| [05-inbox-views.md](./05-inbox-views.md) | Unclassified/Dismissed views, sidebar, visual treatment, batch actions | Working on Phase 2 (views) |
| [06-metrics-and-analytics.md](./06-metrics-and-analytics.md) | Toolbar indicator, PostHog events | Working on Phase 5 (metrics) |
| [07-detail-sheet-and-lead-creation.md](./07-detail-sheet-and-lead-creation.md) | Classification badge, reclassify action, lead creation pre-fill | Working on Phase 4 |
| [08-future-enhancements.md](./08-future-enhancements.md) | Deferred features: rules engine, AI classification, smart ordering, meeting transcripts | Planning future work |

### Project Management

| Document | Contents |
|----------|----------|
| [PROGRESS.md](./PROGRESS.md) | Running log of completed work, decisions, blockers — updated after each coding session |
| [TEST-PLAN.md](./TEST-PLAN.md) | Manual test cases organized by phase — updated after each coding session |

## Implementation Phases & Dependencies

```
Phase 1: Data Model & Sync Changes
├── 02-data-model.md (schema, migration, invariants)
├── 03-sync-changes.md (remove auto-linking)
└── No dependencies — start here

Phase 2: Inbox Views Update                    ← depends on Phase 1
├── 05-inbox-views.md (unclassified, dismissed, sidebar)
└── Requires: classification column exists

Phase 3: Triage Mode UI                        ← depends on Phase 1
├── 04-triage-mode.md (triage card, API, matcher refactor)
└── Requires: classification column exists, matchers refactored

Phase 4: Detail Sheet & Lead Creation          ← depends on Phase 1
├── 07-detail-sheet-and-lead-creation.md
└── Requires: classification column exists, dismiss-unlinks behavior

Phase 5: Batch Actions & Metrics               ← depends on Phase 2
├── 05-inbox-views.md §5.6 (batch actions)
├── 06-metrics-and-analytics.md
└── Requires: views updated, classification column exists
```

**Parallelization**: Phases 2, 3, and 4 can run in parallel after Phase 1 is complete.

## Resolved Decisions

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Classification states | 3: `UNCLASSIFIED`, `CLASSIFIED`, `DISMISSED` | Binary decision reduces triage friction |
| Rules engine | Cut from v1 | Manual classification only, no auto-magic |
| Sync auto-linking | **Removed** | No auto-linking during sync. All linking is manual/user-approved |
| Triage UI model | Auto-detect track with pre-filled dropdowns | Reuses existing matchers as read-only suggestions |
| Unknown senders | No track pre-selected, dismiss prominent | Most unknowns are noise for a small agency |
| No-match interaction | "Link to Client"/"Link to Lead" buttons expand inline into dropdowns | Fewer states, stays in triage flow |
| Accept requirements | Must select a client or lead before accepting | Every accepted thread is fully linked |
| Any link → CLASSIFIED | Yes, client/project/lead all auto-classify | Linking IS classifying |
| Dismiss behavior | Removes all links | Preserves CLASSIFIED = linked invariant |
| Unlink behavior | Reverts to UNCLASSIFIED if no links remain | Prevents orphaned CLASSIFIED threads |
| Existing data | Backfill linked → CLASSIFIED, rest → UNCLASSIFIED | Full backlog available for triage |
| Unlinked vs Unclassified | Replaced Unlinked, kept Unclassified as list view | List view for scanning, triage for processing |
| Triage focus | Classification only, no task suggestions | Keep triage fast, single cognitive mode |
| Queue ordering | `lastMessageAt` desc | Simple, no pre-computation needed |
| Progress indicator | Session count only, not total | Avoids guilt for large backlogs |
| Keyboard shortcuts | 5 shortcuts for v1 | Minimal, expand based on feedback |
| Lead creation | Opens existing lead sheet (pre-filled) | Reuse existing UI, don't duplicate |
| Detail sheet | Shows badge + allows reclassify | Reclassify respects unlink-on-dismiss invariant |
| Rule ownership | Global/admin (deferred with rules engine) | — |
