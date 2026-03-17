# 05: Inbox Views Update

> Part of [PRD 009: Inbox Classification & Triage](./README.md)
> Phase: **2 — Inbox Views Update** (views), **5 — Batch Actions & Metrics** (batch actions)
> Dependencies: [02-data-model.md](./02-data-model.md) (classification column must exist)

## Replace Unlinked with Unclassified

The existing `unlinked` view under Emails is replaced by **Unclassified**:

- URL: `/my/inbox/emails/unclassified` (replaces `/my/inbox/emails/unlinked`)
- Shows threads with `classification = 'UNCLASSIFIED'` as a standard list view (same layout as Inbox view)
- Badge count in sidebar shows unclassified count
- **"Start Triage" button** links to `/my/inbox/triage` when count > 0
- Useful for scanning/searching unclassified threads without the one-at-a-time triage flow

## Add Dismissed View

- URL: `/my/inbox/emails/dismissed`
- Shows threads with `classification = 'DISMISSED'`
- Recovery path: user can undo a dismissal and reclassify (sets back to `UNCLASSIFIED`)
- No sidebar badge (dismissed count is not actionable)

## Remove Linked View

The `linked` view is removed. Classification replaces this concept:
- `CLASSIFIED` threads are, by definition, linked (see [02-data-model.md invariant](./02-data-model.md#thread-classification-enum))
- Users who want to see linked threads can filter the main inbox

## Updated Sidebar

| View | Badge | Shows |
|------|-------|-------|
| **Inbox** | Unread count | All non-dismissed threads (existing behavior) |
| **Unclassified** | Unclassified count | `classification = 'UNCLASSIFIED'` threads |
| **Sent** | — | Sent threads (existing) |
| **Drafts** | Draft count | Drafts (existing) |
| **Scheduled** | Scheduled count | Scheduled (existing) |
| **Dismissed** | — | `classification = 'DISMISSED'` threads |

## Visual Treatment by Classification

In the main inbox list view, threads show a subtle classification indicator:

| Classification | Visual Treatment |
|----------------|-----------------|
| `UNCLASSIFIED` | Yellow dot indicator |
| `CLASSIFIED` | Green dot, linked entity badges (client/project/lead name) |
| `DISMISSED` | Greyed out, muted text |

## Batch Actions in List View (Phase 5)

The existing inbox list view gains:
- Multi-select threads (checkbox on hover, shift-click for range)
- Batch dismiss: dismiss all selected threads at once (removes links per [02-data-model.md §Dismiss Unlinks](./02-data-model.md#dismiss-unlinks))
- Batch actions appear in a floating toolbar when threads are selected

## Implementation Checklist

**Phase 2:**
1. Replace "Unlinked" view with "Unclassified" view (update valid views whitelist, query filter)
2. Add "Dismissed" view with undo-dismiss recovery action
3. Remove "Linked" view from valid views and sidebar
4. Update sidebar counts query (`getInboxSidebarCounts`) to use classification column
5. Add classification dot indicators to `thread-row.tsx`

**Phase 5 (batch actions):**
1. Add multi-select state to inbox list (checkboxes, shift-click range)
2. Build floating batch action toolbar
3. Implement batch dismiss endpoint
