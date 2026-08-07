# 04 — Close workflow UI + drift detection

The report page becomes close-aware: open months render live with a **Close** action; closed months render **from the snapshot** with a live-vs-snapshot drift check (D8) — making it impossible to unknowingly invoice or pay out against numbers that changed after the close.

**Requires section 02 first**: drift compares snapshot vs live, and the live derivation must already be temporal — otherwise a billing-term change reads as phantom drift on every closed month.

## Data layer: snapshot-aware report fetch

Extend [apps/internal/lib/data/reports/monthly-close.ts](../../../apps/internal/lib/data/reports/monthly-close.ts) with a wrapper (keeping `fetchMonthlyCloseReport` pure/live):

```ts
export type MonthlyCloseView = {
  report: MonthlyCloseReport      // snapshot report when closed, live otherwise
  close: {
    status: 'open' | 'closed'
    closedAt?: string
    closedByName?: string | null
    drift?: CloseDrift | null     // only computed for closed months
  }
}
```

`fetchMonthlyCloseView(year, month)`: no snapshot → live report, `status: 'open'`. Closed → decode via `parseSnapshotReport` (03), **also** derive the live report (React `cache()` dedupes), compute `CloseDrift`. The **snapshot** drives rendering; month-navigation cursors come from the live derivation.

## Drift computation

```ts
export type CloseDrift = {
  hasDrift: boolean
  deltas: Array<{
    section: 'prepaidBilling' | 'net30Billing' | 'payroll' | 'origination' | 'closer' | 'partnerPayouts'
    label: string                 // section, or "section · payee/client" for row-level diffs
    snapshotValue: number         // hours or dollars, per the row
    liveValue: number
  }>
  lateRecords: Array<{
    kind: 'time_log' | 'hour_block'
    id: string
    clientName: string | null
    hours: number
    eventDate: string             // logged_on / billing_month date
    recordedAt: string            // created_at, updated_at, or deleted_at — whichever tripped
    change: 'added' | 'modified' | 'deleted'
  }>
}
```

- **Canonical comparison (F2)** — hours-only totals miss real drift (hours moved between users, a closer swap, offsetting ±edits all change *who gets paid* with section totals unchanged). Compare a canonical projection of snapshot vs live: per-section `totalHours` **and** `totalAmount`; per-client rows of the two billing sections; per-payee `partnerPayouts` rows (keyed `kind:id`, comparing each amount column). Any difference (numbers rounded to 2 decimals — hours are NUMERIC(8,2)) → `hasDrift`, with row-level deltas labeled "Origination · Acme" / "Payouts · Jane".
- **Late records** (new query in `apps/internal/lib/queries/reports/close-snapshots.ts`): time logs with `logged_on` in the month AND (`created_at > closed_at` OR `updated_at > closed_at` OR `deleted_at > closed_at`); hour blocks with `billing_month` in the month (F7) AND (`created_at > closed_at` OR `updated_at > closed_at` OR `deleted_at > closed_at`). A webhook-created block can land in an early-closed current month, so hour blocks can now be `'added'` too.
- **Prerequisite (F1)**: `updateTimeLog` and `softDeleteTimeLog` in [apps/internal/lib/queries/time-logs/mutations.ts](../../../apps/internal/lib/queries/time-logs/mutations.ts) do **not** currently set `updatedAt` — both must add `updatedAt: new Date().toISOString()` to their `.set()` calls (matching the hour-block actions' existing pattern) or the `updated_at` predicate never fires. The `deleted_at > closed_at` check covers soft-deletes independently as belt-and-braces.
- `hasDrift` is driven by the **comparison**; `lateRecords` is best-effort attribution. A delta with no matching records (e.g. a billing-term change or partner reassignment) renders as "cause unknown — compare sections manually".

## Page + components

[apps/internal/app/(dashboard)/reports/monthly-close/page.tsx](<../../../apps/internal/app/(dashboard)/reports/monthly-close/page.tsx>) switches to `fetchMonthlyCloseView` and passes `close` down.

**`close-controls.tsx`** (client component, in `report-header.tsx`'s row):

- Open month → `Close August 2026` button → confirm dialog stating the freeze ("Snapshot billing, payouts, and commissions for August 2026. Late changes will be flagged as drift."). Closing the in-progress current month adds a warning line ("August isn't over — you usually close after month end.").
- Closed month → status chip `Closed Sep 2 by Jason` + `Reopen…` button → confirm dialog ("Reopening discards the frozen numbers and re-derives live. Close again when you're done.").
- Errors surface via the existing toast pattern.
- The page's `month` search param is 0-indexed — convert to 1-indexed before calling the actions (W4, see section 03).

**`closed-notice.tsx`**: quiet banner on closed, drift-free months — "This month is closed. Numbers are frozen as of Sep 2, 2026." (Visual language of `formula-notice.tsx`.) If `parseSnapshotReport` rejects the payload (F9), render the explicit "snapshot unreadable — reopen to re-derive" state from section 03 instead of the report.

**`drift-banner.tsx`**: prominent (destructive-tinted) banner on closed months with drift:

> **Live data differs from the August 2026 close.**
> Net 30 billing: 120.00h closed → 123.50h live (+3.50h)
> • +3.5h time log for Acme (logged Aug 30, entered Sep 3)
> [Reopen & re-close]

"Reopen & re-close" calls the `reclose-month.ts` action (03). There is **no dismiss**: the banner is an unreconciled-books warning and stays visible until the drift is resolved.

## Acceptance criteria

- [ ] Open months render live with a Close button; closing swaps the page to snapshot rendering with the closed chip
- [ ] Closed months render identical data before/after unrelated DB changes (mutate a time log → sections don't move, only the banner appears)
- [ ] Backdating a time log into a closed month produces the drift banner with correct delta and record attribution
- [ ] Editing a closed-month time log or hour block produces drift with `change: 'modified'`; soft-deleting produces `change: 'deleted'`
- [ ] Reassigning a closed month's hours between users (or swapping the client's closer) produces drift even though section hour totals are unchanged (F2)
- [ ] Reopen & re-close clears drift and updates the frozen numbers
- [ ] Current-month close shows the extra warning; month navigation still works on closed months
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from repo root
