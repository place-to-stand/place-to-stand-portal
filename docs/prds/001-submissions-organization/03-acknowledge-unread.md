# 03 — Acknowledge Action + Unread Indicator

**Depends on:** [01-schema-acknowledgement.md](01-schema-acknowledgement.md), [02-page-shell-tabs.md](02-page-shell-tabs.md)
**Blocks:** [05-activity-events.md](05-activity-events.md), [06-nav-unread-badge.md](06-nav-unread-badge.md)
**Decisions:** D1, D2, D6, D8, D9 (see [README](README.md))

## Problem statement

Transcript (00:40:56): "I think we just need some organizational aspects on the submission screen like an unread with an acknowledge button." The table gives no signal which rows a human has reviewed, and there is no action to mark one reviewed.

## Fix description

Define the unread predicate as a shared helper (D1), render an unread indicator on qualifying rows, and add an explicit Acknowledge server action reachable from both the table row and the detail sheet (D2). Server-action structure mirrors `apps/internal/app/(dashboard)/hour-blocks/actions/` (see `archive-hour-block.ts` for the canonical shape: `requireUser` → `assertAdmin` → zod parse → fetch existing → mutate → log → `revalidatePath`).

## Implementation details

### 1. Unread predicate — `apps/internal/lib/form-submissions/constants.ts`

```ts
/**
 * D1: only rows that warrant attention count as unread — contact submissions
 * (any status) and audits that reached `completed`/`captured`. In-progress and
 * abandoned audits are noise at ad volume and never flag.
 *
 * Must stay in sync with the SQL predicate in
 * `countUnreadFormSubmissions` (lib/queries/form-submissions.ts, section 06).
 */
export const ATTENTION_AUDIT_STATUSES = [
  'completed',
  'captured',
] as const satisfies readonly FormSubmissionStatus[]

export function isUnreadSubmission(submission: {
  kind: FormSubmissionKind
  status: FormSubmissionStatus
  acknowledgedAt: string | null
  deletedAt: string | null
}): boolean {
  if (submission.acknowledgedAt !== null || submission.deletedAt !== null) {
    return false
  }
  return (
    submission.kind === 'contact' ||
    (ATTENTION_AUDIT_STATUSES as readonly string[]).includes(submission.status)
  )
}
```

### 2. Query — `apps/internal/lib/queries/form-submissions.ts`

```ts
/**
 * Idempotent: only sets acknowledgement if not already acknowledged, so a
 * double-click or two admins racing never overwrites the first reviewer.
 * Returns the updated row (or null when the id doesn't exist / is archived).
 */
export async function acknowledgeFormSubmission(id: string, userId: string) {
  const [row] = await db
    .update(formSubmissions)
    .set({
      acknowledgedAt: sql`timezone('utc'::text, now())`,
      acknowledgedBy: userId,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(
      and(
        eq(formSubmissions.id, id),
        isNull(formSubmissions.deletedAt),
        isNull(formSubmissions.acknowledgedAt)
      )
    )
    .returning()

  return row ?? null
}
```

Note: a null return from the race/double-click path is *success-shaped* for the UI (the row is acknowledged either way) — the action must distinguish "already acknowledged" from "not found" by re-fetching (see below), not by treating null as an error.

### 3. Server action — `apps/internal/app/(dashboard)/submissions/actions/acknowledge-submission.ts` (new)

Create the `actions/` directory in the hour-blocks style:

- `types.ts` — `export type ActionResult = { error?: string }`, `export type SubmissionActionInput = { id: string }`
- `schemas.ts` — `export const submissionIdSchema = z.object({ id: z.string().uuid() })`
- `helpers.ts` — `export const SUBMISSIONS_PATH = '/submissions'`, `export const SUBMISSIONS_ARCHIVE_PATH = '/submissions/archive'`
- `index.ts` — re-exports

```ts
'use server'
// acknowledge-submission.ts
export async function acknowledgeSubmission(
  input: SubmissionActionInput
): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = submissionIdSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid request.' }

  const existing = await getFormSubmissionById(parsed.data.id)
  if (!existing) return { error: 'Submission not found.' }

  if (existing.acknowledgedAt === null) {
    const updated = await acknowledgeFormSubmission(parsed.data.id, user.id)
    if (updated) {
      // Activity logging added in section 05 (submissionAcknowledgedEvent).
    }
  }

  // D6: badge lives in the (dashboard) layout — revalidate the whole layout
  // tree so the sidebar count refreshes wherever the user navigates next.
  revalidatePath('/', 'layout')

  return {}
}
```

Wrap in try/catch around the mutation like the hour-blocks actions (`console.error` + `{ error }` return). **PostHog: ship with NO server tracking (W2, [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))** — do not reuse `trackSettingsServerInteraction`: its `SettingsEntity` union (`apps/internal/lib/posthog/settings-types.ts:6`) has no `'form_submission'` value (type error) and it emits `SETTINGS_SAVE`, which would misclassify inbox actions as settings saves. Purpose-built event naming is future scope pending the naming conversation (project PostHog rule).

### 4. Table UI — `_components/submissions-table.tsx`

Only when `mode === 'active'`:

- **Indicator:** unread rows (per `isUnreadSubmission`) get a leading indicator cell — a `size-2 rounded-full bg-primary` dot with `sr-only` text "Unread" — and `font-medium` on the row. Read rows render an empty cell. Add the extra `TableHead` (empty label, `w-6`) and bump the empty-state `colSpan` accordingly.
- **Row action:** an `Acknowledge` button in a trailing actions cell, rendered only for unread rows — small labeled `Button` matching the hour-blocks actions-cell style (`variant='outline'`, size sm; see `apps/internal/app/(dashboard)/hour-blocks/_components/hour-blocks-table-section.tsx`). `onClick` must `event.stopPropagation()` (row click opens the sheet). Wire through a `useTransition` + toast-on-error pattern consistent with other tables; on success call `router.refresh()`.

### 5. Detail sheet — `_components/submission-detail-sheet.tsx`

- Header area shows an `Unread` badge (reuse `Badge` with a muted token) when `isUnreadSubmission(submission)`.
- Footer (or under the header): primary `Acknowledge` button for unread submissions; for acknowledged ones show muted text `Acknowledged {relative time}` (use `formatDistanceToNow` like the table's Received column). `acknowledgedBy` display is optional — the sheet only has the raw id; showing the timestamp alone is acceptable (resolving the user name would require a join; note as nice-to-have in future scope).
- **D9: acknowledging from the sheet keeps it open.** After a successful acknowledge the sheet's `submission` prop is stale (server data refreshed underneath), so lift acknowledged state optimistically — local `useState` acknowledged flag + `router.refresh()`. Do not close the sheet; that matches D2's "review then acknowledge" flow. (Archive/Restore behave differently — they close the sheet; see [04-archive-restore.md](04-archive-restore.md).)

### 6. Unread quick filter (PW1 — [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

The badge (06) tells the admin *how many* rows are unread, but `last_activity_at DESC` ordering interleaves ad noise — nothing helps them find *which* rows. Add an **Unread** filter on the List tab:

- `SubmissionsFilters` (02) gains an unread toggle — either a two-state `Select` ("All" / "Unread") or a `Checkbox`-style toggle button, whichever reads best next to the two existing selects — writing URL param `unread=1` (absent = all). Resets to page 1 like the other filters. List tab only (`basePath='/submissions'` consumers); archived rows are never unread, so the archive page ignores/omits it.
- `page.tsx` parses `unread` and threads `unreadOnly: boolean` through `fetchFormSubmissions` → `listFormSubmissions`/`countFormSubmissions`.
- `buildFilters` gains the D1 predicate under `unreadOnly` (same SQL shape as `countUnreadFormSubmissions` in 06 — keep the sync comments pointing at each other):

```ts
    unreadOnly
      ? and(
          isNull(formSubmissions.acknowledgedAt),
          or(
            eq(formSubmissions.kind, 'contact'),
            inArray(formSubmissions.status, ['completed', 'captured'])
          )
        )
      : undefined,
```

- Combined filters compose: `unread=1&kind=audit` shows unread completed/captured audits only.

### 7. Actionable contact email (PW2)

In the detail sheet, render `contactEmail` as a `mailto:` link (underlined, with the sheet's existing external-link affordance) instead of plain text — the natural post-triage action is emailing the prospect ("we should probably email these people anyways", transcript 00:46:13). Table cell stays plain text (row click opens the sheet).

### 8. Sort order (explicitly unchanged)

The list stays ordered by `last_activity_at DESC`. Unread rows are *not* pinned to the top — newest-first already surfaces new arrivals, and pinning would fight the beacon-driven reordering. (Revisit in future scope if the team asks.)

## Architecture review notes

- The unread predicate lives in exactly one TS helper and one SQL count (section 06); the PRD marks both with sync comments so they can't drift silently.
- Idempotency at the query layer (conditional `UPDATE … WHERE acknowledged_at IS NULL`) makes double-clicks and concurrent admins safe without transactions.
- D8 interaction: after acknowledge, a later status-advancing beacon clears `acknowledged_at` (section 01) — the row legitimately reappears as unread. This is intended; TEST-PLAN covers it.

## Acceptance criteria

- [ ] `isUnreadSubmission` helper exists with the D1 predicate and a sync-comment pointing at the SQL count
- [ ] Unread rows (contact any-status; audit completed/captured; unacknowledged; not archived) show a dot indicator + medium font; other rows don't
- [ ] `in_progress` and `abandoned` audit rows never show the indicator even when unacknowledged
- [ ] Acknowledge button appears on unread rows (table) and in the detail sheet; clicking it marks the row read without opening/closing the sheet unexpectedly
- [ ] Row-button click does not open the detail sheet (`stopPropagation`)
- [ ] Opening the detail sheet does NOT acknowledge (D2)
- [ ] Double-clicking Acknowledge (or two sessions racing) results in one acknowledgement, no error surfaced
- [ ] Acknowledged state shows `Acknowledged {relative time}` in the sheet
- [ ] Action is admin-only (`assertAdmin`); invalid/unknown UUID returns a friendly error
- [ ] `revalidatePath('/', 'layout')` called on success (badge dependency for section 06)
- [ ] PW1: Unread filter on the List tab (`?unread=1`) shows only D1-unread rows, composes with kind/status filters, resets to page 1, and is absent from the archive page
- [ ] PW2: `contactEmail` in the detail sheet is a working `mailto:` link
- [ ] No PostHog server tracking in any submissions action (W2)
- [ ] `npm run build && npm run lint && npm run type-check` pass from repo root

## Files likely modified / created

- `apps/internal/lib/form-submissions/constants.ts` (modified)
- `apps/internal/lib/queries/form-submissions.ts` (modified — acknowledge mutation + PW1 `unreadOnly` filter)
- `apps/internal/lib/data/form-submissions/index.ts` (modified — PW1 `unreadOnly` fetch option)
- `apps/internal/app/(dashboard)/submissions/page.tsx` (modified — PW1 `unread` param)
- `apps/internal/app/(dashboard)/submissions/_components/submissions-filters.tsx` (modified — PW1 unread toggle)
- `apps/internal/app/(dashboard)/submissions/actions/acknowledge-submission.ts` (new)
- `apps/internal/app/(dashboard)/submissions/actions/{types,schemas,helpers,index}.ts` (new)
- `apps/internal/app/(dashboard)/submissions/_components/submissions-table.tsx` (modified)
- `apps/internal/app/(dashboard)/submissions/_components/submission-detail-sheet.tsx` (modified)
