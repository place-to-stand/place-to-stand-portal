# 03 — Schema: `monthly_close_snapshots` + close/reopen actions

The "close the books" primitive: an explicit, admin-triggered snapshot that freezes a month's assembled report. Closing is an *event you trigger* (after the remember-it-before-invoicing pass), not a calendar boundary (D6) — logging time a day or two into the new month costs nothing while the month is still open.

## Table definition

Add to `packages/db/src/schema.ts`:

```ts
export const monthlyCloseSnapshots = pgTable(
  'monthly_close_snapshots',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    year: integer().notNull(),
    month: integer().notNull(), // 1-indexed, CHECK 1–12 (hand-added)
    /** Fully assembled MonthlyCloseReport payload + { schemaVersion: 1 } (D12). */
    report: jsonb().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    closedBy: uuid('closed_by'),
    createdAt: …, updatedAt: …, deletedAt: …, // standard trio
  },
  table => [
    // One ACTIVE close per month; reopen soft-deletes, re-close inserts (D7).
    uniqueIndex('uq_monthly_close_snapshots_period')
      .on(table.year, table.month)
      .where(sql`(deleted_at IS NULL)`),
  ]
)
```

- `closed_by` → `users.id` **SET NULL**. Relations: snapshot → one `closedByUser`.
- Hand-added in the generated migration: `CHECK ("month" BETWEEN 1 AND 12)`.
- Reopen = **soft delete** the active row; every close attempt (who, when, what numbers) is preserved for audit (D7). **No RLS.**

Migration: `npm run db:generate -- --name monthly_close_snapshots` from `packages/db/`.

## Snapshot payload

`report` stores the exact `MonthlyCloseReport` object from [apps/internal/lib/data/reports/monthly-close.ts](../../../apps/internal/lib/data/reports/monthly-close.ts) — sections, totals, per-client rows, and the `rates` block — wrapped as `{ schemaVersion: 1, report }`:

- `minCursor`/`maxCursor` are **excluded** (global navigation bounds, always computed live).
- `parseSnapshotReport(jsonb): MonthlyCloseReport` in the data layer is the single decode point, and it **zod-validates** the payload (F9): a versioned discriminated schema — version 1 validates the current `MonthlyCloseReport` shape; an unknown `schemaVersion` or failed parse throws a typed error that section 04 renders as an explicit "snapshot unreadable — reopen to re-derive" state, never a crash or silent misread. Future report-shape changes bump the version and add a migrate-on-read branch.
- The snapshot must render **without running any live queries** (D12).

## Queries + data layer

New `apps/internal/lib/queries/reports/close-snapshots.ts` (`server-only`):

- `getActiveSnapshot(year, month)` — active row or null
- `insertSnapshot({ year, month, report, closedBy })`
- `softDeleteSnapshot(year, month)`
- `getClosedMonthSet(range)` — which months are closed; backs the guardrails (05) and the billing-change closed-month guard (01)

New `apps/internal/lib/data/reports/close.ts` (`server-only`):

- `closeMonth(user, { year, month })` — `assertAdmin`; reject future months (`'Cannot close a month that has not started.'`). **Cutoff-first, transactional (F4):** capture `closedAt = now()` *before* deriving, run the derivation + `insertSnapshot` inside one `db.transaction` (Postgres default read-committed within a single transaction gives every report query one consistent view), and store the pre-captured `closedAt` — so any record committed after the cutoff is, by definition, detectable as late (`created_at > closed_at`). Closing the in-progress current month is allowed — the UI confirms with a warning (04). Log activity after commit.
- `reopenMonth(user, { year, month })` — `assertAdmin`; `softDeleteSnapshot`; log activity.
- `recloseMonth(user, { year, month })` — **atomic swap, not sequential reopen→close (F3):** derive the replacement report first (same cutoff-first rule), then in one transaction soft-delete the active snapshot and insert the new one. A derivation or insert failure leaves the original snapshot untouched — the month never transiently loses its close.
- `isMonthClosed(date)` — convenience over `getClosedMonthSet` for 01/05 (accepts `yyyy-MM-dd`, checks its month).

## Server actions

`apps/internal/app/(dashboard)/reports/monthly-close/actions/` (`'use server'`, mirroring the submissions actions structure): `close-month.ts`, `reopen-month.ts`, `reclose-month.ts` (calls the atomic `recloseMonth` — backs section 04's one-click drift fix), plus `schemas.ts` (zod: `year` int, `month` 1–12) and `types.ts` (`{ error?: string }` results). All call the data layer, then `revalidatePath('/reports/monthly-close')`.

Race-safe by construction: concurrent close hits the unique partial index → `'This month is already closed.'`; reopen of a not-closed month → `'This month is not closed.'`

**Month indexing (W4):** the report URL's `month` search param is **0-indexed** ([page.tsx](<../../../apps/internal/app/(dashboard)/reports/monthly-close/page.tsx>) ~line 49); the snapshots table and these zod schemas are **1-indexed**. Convert (`urlMonth + 1`) at the page → action boundary — zod's `min(1)` makes a missed conversion fail loudly for January instead of silently closing December.

## Activity events

New `apps/internal/lib/activity/events/monthly-close.ts`, re-exported from `events.ts`:

- `monthlyCloseClosedEvent({ year, month, combinedBillingTotal, combinedPayoutTotal })` — "closed August 2026 (billing $12,400 / payouts $11,150)"
- `monthlyCloseReopenedEvent({ year, month })`

Target type: add `'MONTHLY_CLOSE'` to the `ActivityTargetType` union in [apps/internal/lib/activity/types.ts](../../../apps/internal/lib/activity/types.ts) (`target_type` is text — no migration). `targetId`: the snapshot row id. **Must not** be added to `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES` (D11). **Do** add it to the separate `VALID_TARGET_TYPES` filter list in `apps/internal/app/api/activity/route.ts` (~line 12) so admins can filter by it — the role gate below that list already excludes CLIENT users (I1).

## Acceptance criteria

- [ ] Closing a month persists a snapshot whose JSONB round-trips to the exact live report (deep-equal minus cursors)
- [ ] Second close of the same month fails cleanly with the already-closed message
- [ ] Reopen soft-deletes; re-close inserts a fresh row; both prior rows remain queryable
- [ ] Future months cannot be closed
- [ ] Close/reopen events appear under `MONTHLY_CLOSE` and stay invisible to CLIENT-role activity surfaces
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from repo root
