# 05 — Activity Events + Activity Tab

**Depends on:** [02-page-shell-tabs.md](02-page-shell-tabs.md), [03-acknowledge-unread.md](03-acknowledge-unread.md), [04-archive-restore.md](04-archive-restore.md)
**Blocks:** nothing
**Decisions:** D5 (see [README](README.md))

## Problem statement

The submissions surface performs no activity logging, so the Activity tab (mandated by D5, hour-blocks parity) has nothing to show, and there is no audit trail of who acknowledged/archived/restored a submission. The activity system already has everything needed: `logActivity` (`apps/internal/lib/activity/logger.ts`), per-domain event builders (`apps/internal/lib/activity/events/`), and the generic `ActivityFeed` component (`apps/internal/components/activity/activity-feed.tsx`).

## Fix description

Add a `SUBMISSION` target type and three verbs (TypeScript-only — `activity_logs.target_type` and `verb` are `text` columns, no migration), a `submissions.ts` event-builder module, `logActivity` calls in the three actions from 03/04, and the Activity tab feed completing the 02 stub.

## Implementation details

### 1. Types — `apps/internal/lib/activity/types.ts`

- Add `'SUBMISSION'` to the `ActivityTargetType` union (after `'LEAD'` — it's a sales-surface sibling).
- Add to `ActivityVerbs` (grouped with a `// Submission events` comment like the Lead/Invoice groups):

```ts
  SUBMISSION_ACKNOWLEDGED: 'SUBMISSION_ACKNOWLEDGED',
  SUBMISSION_ARCHIVED: 'SUBMISSION_ARCHIVED',
  SUBMISSION_RESTORED: 'SUBMISSION_RESTORED',
```

### 2. Event builders — `apps/internal/lib/activity/events/submissions.ts` (new)

Follow `events/hour-blocks.ts` exactly (builders return `ActivityEvent`; metadata via `toMetadata` from `./shared`). Summaries need a human handle for a row that is often anonymous:

```ts
import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'
import { toMetadata } from './shared'

/** "Jane Doe (jane@x.com)" | name | email | "anonymous audit submission" */
const describeSubmission = (args: {
  kind: 'audit' | 'contact'
  contactName?: string | null
  contactEmail?: string | null
}): string => { … }

export const submissionAcknowledgedEvent = (args: {
  kind: 'audit' | 'contact'
  contactName?: string | null
  contactEmail?: string | null
  status: string
}): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_ACKNOWLEDGED,
  summary: `Acknowledged ${describeSubmission(args)}`,
  metadata: toMetadata({ status: args.status }),
})

export const submissionArchivedEvent = (args: { … }): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_ARCHIVED,
  summary: `Archived ${describeSubmission(args)}`,
  metadata: toMetadata({ status: args.status }),
})

export const submissionRestoredEvent = (args: { … }): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_RESTORED,
  summary: `Restored ${describeSubmission(args)}`,
  metadata: toMetadata({ status: args.status }),
})
```

Re-export from `apps/internal/lib/activity/events.ts` alongside the other domains.

### 3. Instrument the actions (modifies 03/04 files)

In `acknowledge-submission.ts`, `archive-submission.ts`, `restore-submission.ts` — after a successful mutation, mirroring `archive-hour-block.ts`:

```ts
const event = submissionAcknowledgedEvent({
  kind: existing.kind,
  contactName: existing.contactName,
  contactEmail: existing.contactEmail,
  status: existing.status,
})

await logActivity({
  actorId: user.id,
  actorRole: user.role,
  verb: event.verb,
  summary: event.summary,
  targetType: 'SUBMISSION',
  targetId: existing.id,
  targetClientId: null, // submissions precede any client relationship
  metadata: event.metadata,
})
```

Log only when the mutation actually changed state (the query returned a row) — the idempotent no-op paths in 03/04 must not emit duplicate events.

### 4. Activity tab — completes the 02 stub

`_components/submissions-activity-section.tsx` (new), cloned from `hour-blocks-activity-section.tsx` (dynamic-import `ActivityFeed`, `ssr: false`):

```tsx
<ActivityFeed
  targetType='SUBMISSION'
  pageSize={20}
  emptyState='No recent submission activity.'
  requireContext={false}
/>
```

Heading: "Recent activity" / "Audit submission acknowledgements, archives, and restores in one place." Render it inside the card on `activity/page.tsx`.

### 5. Activity API route — whitelist entry + gate verification (C1, W1 — see [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

`ActivityFeed` fetches through `GET /api/activity` (`apps/internal/lib/activity/use-activity-feed.ts`), and that route **rejects unlisted target types with a 400** via its runtime `VALID_TARGET_TYPES` array. Two required changes in `apps/internal/app/api/activity/route.ts`:

1. **C1:** Add `'SUBMISSION'` to `VALID_TARGET_TYPES` (line ~8). Without this the Activity tab renders a permanent "Unable to load activity." error.
2. **W1 — already enforced systemically, verify only.** The activity API is now role-scoped (landed after this PRD's audit, in the W1 follow-up task): the route 403s non-admin requests for any target type outside `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES` (`apps/internal/lib/activity/types.ts`), and `fetchActivityLogs` re-enforces the allowlist plus row scoping. Do **not** add `SUBMISSION` to `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES` — leaving it off is what keeps it admin-only. No per-type gate code is needed in this section; just verify the 403 behavior in TEST-PLAN.

Verified (I1): `apps/internal/components/activity/activity-feed-item.tsx` renders summaries directly — there is **no** target-type/verb label or icon map to extend. The route changes above are the only feed-path work.

## Architecture review notes

- Text columns for `verb`/`target_type` mean old rows and new verbs coexist without migration; the union type is the single source of truth at compile time.
- `targetClientId: null` is deliberate — a form submission has no client linkage. If a submission is ever promoted to a lead (future scope), the lead events carry the linkage from there.
- Intake upserts (webhook writes) are **not** logged — no actor, high volume, and the transcript's need is auditing *admin* actions only.

## Acceptance criteria

- [ ] `SUBMISSION` in `ActivityTargetType`; three new verbs in `ActivityVerbs`
- [ ] `events/submissions.ts` builders exported via `apps/internal/lib/activity/events.ts`
- [ ] Acknowledge, archive, and restore each write one activity log with correct verb, summary (name/email or "anonymous audit submission"), `targetType: 'SUBMISSION'`, and status metadata
- [ ] Idempotent no-op paths (double-click, already-acknowledged) write no activity log
- [ ] `'SUBMISSION'` added to `VALID_TARGET_TYPES` in `apps/internal/app/api/activity/route.ts` (C1) and NOT added to `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES` in `apps/internal/lib/activity/types.ts`
- [ ] `/api/activity` rejects `targetType=SUBMISSION` for non-admin users with 403 (W1 — enforced by the pre-existing role scoping; verify, don't re-implement)
- [ ] `/submissions/activity` shows the feed newest-first with actor attribution, matching hour-blocks activity styling
- [ ] Empty state renders when no submission activity exists
- [ ] Activity tab admin-gated like the others
- [ ] `npm run build && npm run lint && npm run type-check` pass from repo root

## Files likely modified / created

- `apps/internal/lib/activity/types.ts` (modified)
- `apps/internal/lib/activity/events/submissions.ts` (new)
- `apps/internal/lib/activity/events.ts` (modified — re-export)
- `apps/internal/app/(dashboard)/submissions/actions/{acknowledge,archive,restore}-submission.ts` (modified)
- `apps/internal/app/(dashboard)/submissions/_components/submissions-activity-section.tsx` (new)
- `apps/internal/app/(dashboard)/submissions/activity/page.tsx` (modified — completes 02 stub)
- `apps/internal/app/api/activity/route.ts` (modified — C1 whitelist entry only; W1 gating is already enforced systemically)
