# PRD 007 — Effective-dated commission terms, optional closer, House (estimated)

**Status:** Implemented September 2026 (branch `claude/damon-closer-removal-impact-813a40`).
**Origin:** PRD 002 future scope, item 3 ("effective-dated commission assignments"), pulled forward
when Damon Bodine was removed as closer while every month since October 2025 was already closed.

## Problem

`clients.closer_user_id`, `origination_user_id` and `origination_contact_id` were live, mutable
columns that the Monthly Close joined directly. Reassigning a closer today rewrote what every
already-closed month recomputed as, which surfaced as permanent drift with no late record. The
same exposure PRD 002 fixed for billing type.

Two further gaps showed up in the same conversation:

- The closer was **required** by the server schema, so the only way to stop paying a closer was
  to pay somebody else 20% instead.
- House on the report is **rate-based** (billing hours × $50), not a residual. Dropping a closer
  therefore made that 20% vanish from the split instead of landing in house, and the buckets no
  longer added up to Billing In. The original test plan for the partner formula described house
  as the residual that absorbs unassigned closer commission; the implementation had diverged.

## Decisions

| # | Decision |
|---|----------|
| D1 | New table `client_commission_terms` copies the `client_billing_terms` shape: one row per (client, month-start `effective_from`), soft-deletable, partial unique index, resolution index. Columns: `closer_user_id`, `origination_user_id`, `origination_contact_id` (mutex CHECK). |
| D2 | Backfill inserts one term per existing client (including archived) at the `2000-01-01` sentinel, copying the live columns, so every historical month resolves to exactly what it rendered before. Verified against the prod snapshot set: zero new drift. |
| D3 | The Monthly Close resolves closer/origination **as of period start** (`closerUserIdAsOfSql` etc. in `lib/queries/clients/commission-terms.ts`), never from `clients.*`. The `clients.*` columns stay as the current-value cache the client list, detail page, and sheet read. |
| D4 | Closer is optional. NULL means the closer share is **not paid**; the report carries it under House. |
| D5 | House is **estimated**, everywhere it is shown: `House (est.)` label, `estimated` total label, caption text, drift label. House = nominal rate × billing hours + closer rate × billing hours whose as-of term has no closer. It is never a payout row. |
| D6 | The client sheet reveals a "New closer / origination starts" boundary select (this month / next month) whenever closer or origination differs from the saved assignment, mirroring the billing-type select. The chosen boundary is guarded against closed months inside the update transaction. |
| D7 | Origination stays required (the referral pipeline is the reason to keep it). |
| D8 | Snapshot schema version stays at 1. New house fields (`nominalAmount`, `unassignedCloserHours`, `unassignedCloserAmount`) are optional on decode and default to zero; every existing snapshot had a closer on every billed client, so the defaults are exact. |

## What changed

- `packages/db/src/schema.ts`, `relations.ts`, migration `0077_client_commission_terms.sql` (table + backfill).
- `apps/internal/lib/queries/clients/commission-terms.ts` (new): insert/upsert helpers, as-of SQL fragments.
- `apps/internal/lib/queries/reports/monthly-close.ts`: the six commission joins match on the as-of fragments.
- `apps/internal/lib/data/reports/{types,monthly-close,close,close-drift}.ts`: house top-up, decoder defaults, drift rows.
- `apps/internal/lib/settings/clients/**`: closer optional, `commissionEffective`, term upsert in create/update, activity detail `commissionEffectiveFrom`.
- Client sheet: boundary select, closer picker copy ("No closer — share stays in house").
- Monthly close UI: `House (est.)` in the distribution card, formula notice, house section (with a "No closer assigned" row), closer section footer row.

## Operating notes

- To stop paying a closer: open the client, clear the closer, pick "Next month" (or "This month" if that month is still open), save. Earlier months keep paying the previous closer.
- A boundary that falls in a closed month is refused; reopen the month first (same rule as billing type).
- Re-closing a month after a commission change re-derives with the as-of terms, so it only changes months whose boundary you actually moved.
- House being "estimated" is not a bug to fix later. Payroll is on a work basis and house on a billing basis; they do not reconcile within one month by design.

## Follow-up (October 2026): closer splits

**Origin:** dotfun. Dave Pokk introduced the agency and gets origination; Chris Donahue, who works at
dotfun, pushed the deal through internally. Jason and Kris agreed to split Jason's 20% closer share
with Chris.

| # | Decision |
|---|----------|
| S1 | A commission term now has **zero or more closers**: child table `client_commission_term_closers` (term_id, closer_user_id XOR closer_contact_id, `share_percent` NUMERIC(5,2) in (0, 100]). No rows means no closer, so the share stays in House exactly as before. |
| S2 | Shares must total exactly 100% when there are any closers. A cross-row sum can't be a CHECK, so `closerSplitError` (`lib/settings/clients/closers.ts`) enforces it on the client and in the server schema. |
| S3 | A closer can be an admin user **or a contact** (an insider at the client). Contact closers are paid through the same contact payout row as external originators. |
| S4 | Each closer is paid `client billing hours × share × closer rate`. Report details carry **credited hours** (hours × share) plus `sharePercent`, so `commission = hours × rate`, and House's unassigned-closer top-up (`billing hours − credited hours`) still works unchanged. That includes the share of an archived closer. |
| S5 | Migration 0086 is **additive only**: it creates the table and backfills every term's closer as one row at 100%, so every closed month resolves exactly as before. `client_commission_terms.closer_user_id` and the `clients.closer_user_id` cache stay in the schema, marked deprecated, and are never read or written again. One column can't hold a split, so the list, detail page and sheet read the **newest** term's closers (`fetchLatestClosersByClient`). A follow-up migration drops both columns. |
| S6 | Snapshots stay at schema version 1. The decoder maps legacy `closerUserId` groups to `closerKind: 'user'` / `closerId`, and a missing `sharePercent` defaults to 100. Both are exact for every pre-split close. |
| S7 | In the sheet, adding or removing a closer re-splits evenly (33.34 / 33.33 / 33.33). Shares are then hand-tuned, and the share field only appears once there are two or more closers. A split change uses the same "New assignment starts" boundary as any other commission change. |

**Deploy:**
1. Run `db:migrate:prod` first. The old code keeps working on the old columns.
2. Merge, and let Vercel deploy onto the new table.
3. Check that the anon key gets a 401 on `/rest/v1/client_commission_term_closers`.

If a client is saved between steps 1 and 2, the old code writes a term with `closer_user_id` but no closer rows. The follow-up drop migration must re-run the 0086 backfill, guarded on terms that have no closer rows, before it drops the columns.
