# 04 — Archive / Restore + Archive Tab

**Depends on:** [02-page-shell-tabs.md](02-page-shell-tabs.md)
**Blocks:** [05-activity-events.md](05-activity-events.md)
**Decisions:** D3, D6, D9 (see [README](README.md))

## Problem statement

Transcript (00:50:00): "at the very least I want like an archive uh for especially for the test ones so that we can just delete them really quick" — Kris: "archive for sure I agree with." There is no way to remove a row from the list; test submissions pollute it forever. Per D3 this is the hour-blocks pattern: soft delete via the existing `deleted_at`, an Archive tab, and Restore.

## Fix description

Add archived-mode support to the queries/data layer, `archiveSubmission` / `restoreSubmission` server actions (hour-blocks `actions/` shape), an archive confirm dialog, row/sheet entry points on the List tab, and complete the Archive tab stubbed in 02. No permanent destroy (project convention: never hard delete; see [07-future-scope.md](07-future-scope.md)).

## Implementation details

### 1. Queries — `apps/internal/lib/queries/form-submissions.ts`

Extend the filter builder instead of forking the list function:

```ts
type FormSubmissionFilters = {
  kind?: FormSubmission['kind']
  status?: FormSubmission['status']
  /** false/undefined: active rows (deleted_at IS NULL). true: archived rows. */
  archived?: boolean
}

function buildFilters({ kind, status, archived }: FormSubmissionFilters) {
  return and(
    archived
      ? isNotNull(formSubmissions.deletedAt)
      : isNull(formSubmissions.deletedAt),
    kind ? eq(formSubmissions.kind, kind) : undefined,
    status ? eq(formSubmissions.status, status) : undefined
  )
}
```

`listFormSubmissions` / `countFormSubmissions` pick this up for free. Archived list keeps `ORDER BY last_activity_at DESC`.

Add mutations (both return the updated row or null, like `acknowledgeFormSubmission` in 03):

```ts
export async function setFormSubmissionArchived(id: string, archived: boolean) {
  const [row] = await db
    .update(formSubmissions)
    .set({
      deletedAt: archived ? sql`timezone('utc'::text, now())` : null,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(
      and(
        eq(formSubmissions.id, id),
        archived
          ? isNull(formSubmissions.deletedAt)   // archive: only active rows
          : isNotNull(formSubmissions.deletedAt) // restore: only archived rows
      )
    )
    .returning()

  return row ?? null
}
```

`getFormSubmissionById` currently filters `deleted_at IS NULL`; the restore action needs archived rows. Add an option:

```ts
export async function getFormSubmissionById(
  id: string,
  { includeArchived = false }: { includeArchived?: boolean } = {}
) { … } // existing behavior unchanged when the option is omitted
```

### 2. Data layer — `apps/internal/lib/data/form-submissions/index.ts`

`fetchFormSubmissions` gains `archived?: boolean` in `FetchOptions`, threaded to `listFormSubmissions`/`countFormSubmissions`. Still `assertAdmin` + `cache()`.

### 3. Server actions — `apps/internal/app/(dashboard)/submissions/actions/`

`archive-submission.ts` and `restore-submission.ts`, same skeleton as 03's acknowledge action (`requireUser` → `assertAdmin` → `submissionIdSchema` → fetch existing → mutate → log(05) → revalidate):

- Archive: fetch with default options (must be active); call `setFormSubmissionArchived(id, true)`.
- Restore: fetch with `{ includeArchived: true }` and verify `deletedAt !== null`; call `setFormSubmissionArchived(id, false)`.
- Archiving does **not** touch `acknowledged_at` — archived rows are excluded from every unread predicate anyway (`isUnreadSubmission` checks `deletedAt`, the badge count filters `deleted_at IS NULL`), and preserving the flag means a restored row returns in its prior read state.
- Both revalidate: `revalidatePath('/', 'layout')` (badge — archiving an unread row must decrement it) — this also refreshes `/submissions` and `/submissions/archive`.
- PostHog: same as 03 (W2) — **no server tracking**; do not use `trackSettingsServerInteraction` (closed `SettingsEntity` union + wrong event semantics).

### 4. Archive dialog — `_components/submission-archive-dialog.tsx` (new)

Model on `apps/internal/app/(dashboard)/hour-blocks/_components/hour-block-archive-dialog.tsx` (AlertDialog + pending state). Copy:

> **Archive this submission?** It will move to the Archive tab and stop counting toward unread. You can restore it at any time.

Confirm label `Archive`, cancel `Cancel`. The transcript's driver is "delete test ones really quick," so the dialog is intentionally lightweight — one confirm, no typing.

### 5. Table wiring — `_components/submissions-table.tsx`

- `mode='active'`: trailing actions cell gets an `Archive` button next to 03's Acknowledge — small labeled `Button` matching the hour-blocks actions-cell style (`variant='secondary'` for Archive, mirroring `apps/internal/app/(dashboard)/hour-blocks/_components/hour-blocks-table-section.tsx`); `stopPropagation`. Opens the confirm dialog; on success `router.refresh()` + toast.
- `mode='archive'`: no unread indicator, no Acknowledge; actions cell shows `Restore` (`variant='outline'`, no confirm dialog — restoring is non-destructive and itself reversible). Add an `Archived` column showing `formatDistanceToNow(submission.deletedAt)`.
- Detail sheet: add Archive (active) / Restore (archived) alongside 03's footer controls; pass `mode` down. **D9: a successful Archive or Restore from the sheet closes the sheet** (the row leaves the current tab's list), then `router.refresh()` + toast — unlike Acknowledge, which keeps it open (03).

### 6. Archive page — `archive/page.tsx` (completes the 02 stub)

`fetchFormSubmissions(currentUser, { …, archived: true })`, `mode='archive'`, `activeTab='archive'`, filters with `basePath='/submissions/archive'`, count label `Total archived: {totalCount}`.

## Architecture review notes

- One `setFormSubmissionArchived(id, archived)` mutation with direction-aware `WHERE` guards is idempotent under double-clicks and racing admins, same rationale as 03's acknowledge.
- Reusing `deleted_at` (not a new status enum value) keeps the intake upsert untouched: an archived audit session that receives a late beacon simply upserts into the archived row (the `session_key` conflict target ignores `deleted_at`) — it stays archived. That is correct: archiving a test session shouldn't resurrect it when a stray beacon lands. Covered in TEST-PLAN.
- The existing partial indexes (`WHERE deleted_at IS NULL`) don't serve the archive tab's list query. Archived volume will be tiny (test rows); a seq scan is fine. Do **not** add an archived-side index preemptively (db-review convention: index on demonstrated need).

## Acceptance criteria

- [ ] Archive action on List rows (table + detail sheet) with confirm dialog; row disappears from List on success
- [ ] Archived rows appear on `/submissions/archive` with kind/status filters, pagination, count, and an Archived column
- [ ] Restore action on Archive rows (table + detail sheet, no confirm); row returns to List with its prior acknowledged/unread state
- [ ] Archive or Restore performed from the detail sheet closes the sheet (D9)
- [ ] Archiving an unread submission decrements the nav badge (once 06 lands); restoring an unread one re-increments it
- [ ] Archived rows never show the unread indicator or Acknowledge
- [ ] Double-click / concurrent archive (or restore) is idempotent — one state change, no error
- [ ] Restore of a non-archived id and archive of an unknown id return friendly errors
- [ ] Both actions admin-only; no hard delete path exists anywhere
- [ ] Late beacon for an archived audit session does not un-archive it
- [ ] `npm run build && npm run lint && npm run type-check` pass from repo root

## Files likely modified / created

- `apps/internal/lib/queries/form-submissions.ts` (modified)
- `apps/internal/lib/data/form-submissions/index.ts` (modified)
- `apps/internal/app/(dashboard)/submissions/actions/archive-submission.ts` (new)
- `apps/internal/app/(dashboard)/submissions/actions/restore-submission.ts` (new)
- `apps/internal/app/(dashboard)/submissions/_components/submission-archive-dialog.tsx` (new)
- `apps/internal/app/(dashboard)/submissions/_components/submissions-table.tsx` (modified)
- `apps/internal/app/(dashboard)/submissions/_components/submission-detail-sheet.tsx` (modified)
- `apps/internal/app/(dashboard)/submissions/archive/page.tsx` (modified — completes 02 stub)
