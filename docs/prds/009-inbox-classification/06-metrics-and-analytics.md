# 06: Metrics & Analytics

> Part of [PRD 009: Inbox Classification & Triage](./README.md)
> Phase: **5 — Batch Actions & Metrics**
> Dependencies: [02-data-model.md](./02-data-model.md), [04-triage-mode.md](./04-triage-mode.md), [05-inbox-views.md](./05-inbox-views.md)

## Toolbar Indicator

A compact indicator in the inbox toolbar:
- Shows: "[count] unclassified" with the unclassified count
- Clicking it navigates to `/my/inbox/triage`

## PostHog Events

| Event | Properties |
|-------|-----------|
| `inbox_thread_classified` | `classification`, `source` (`triage`, `manual`, `suggestion_approved`), `track` (`client_work`, `lead`), `had_match` |
| `inbox_triage_started` | `unclassified_count` |
| `inbox_triage_session_ended` | `classified_count`, `dismissed_count`, `skipped_count`, `duration_seconds` |
| `inbox_batch_dismissed` | `count` |

## Implementation Checklist (Phase 5)

1. Add toolbar unclassified count indicator to inbox toolbar component
2. Instrument `inbox_thread_classified` in thread linking action and triage accept
3. Instrument `inbox_triage_started` when triage page loads
4. Instrument `inbox_triage_session_ended` when user navigates away from triage
5. Instrument `inbox_batch_dismissed` in batch dismiss handler
