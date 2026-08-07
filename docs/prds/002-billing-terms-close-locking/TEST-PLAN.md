# PRD 002 — Manual Test Plan

All tests run as an ADMIN user in `apps/internal/`. "The report" = `/reports/monthly-close`.

## Section 01 — Terms schema + billing change flow

- [ ] **01.1 Backfill integrity**: after migration, every client (active + archived) has exactly one terms row at `effective_from = '2000-01-01'`
- [ ] **01.2 New client (settings sheet)**: create a client → terms row with `effective_from` = first of current month, `created_by` = you
- [ ] **01.3 New client (lead conversion)**: convert a lead → same as 01.2
- [ ] **01.4 Constraints**: direct SQL insert with `effective_from = '2026-08-15'` fails the CHECK; duplicate active `(client_id, effective_from)` fails the unique index
- [ ] **01.5 Next-month boundary (default)**: change billing type, keep "Next month" → sheet, client list, and invoice defaults show the new type **immediately**; current month's report keeps the old basis; next month uses the new basis; the change appears in the activity feed with `effectiveFrom`
- [ ] **01.6 This-month boundary**: choose "This month" → current month's report re-derives on the new basis
- [ ] **01.7 Change of mind**: before the boundary, switch the type back → same boundary row overwritten, report and cache match the original state
- [ ] **01.8 Closed-month block**: close the current month (03), then attempt "This month" → blocked with the reopen-first error
- [ ] **01.9 Activity**: exactly one billing-type change entry per save, with before/after and `effectiveFrom` in details

## Section 02 — Temporal resolution

- [ ] **02.1 Zero-drift regression**: record Billing In / Total Payouts / per-section hours for 3 historical months before deploying. After deploy with only backfill rows: identical values
- [ ] **02.2 The real switch**: give the switching client a `prepaid` term effective first of next month. Past + current months: still Net 30, hours unchanged. Next month: under Prepaid (0h until a block is purchased)
- [ ] **02.3 Basis follows everywhere**: origination and closer breakdowns show the client under the correct basis on both sides of the boundary
- [ ] **02.4 Purchased block after cutover**: create an hour block in the cutover month → appears in that month's Prepaid billing; earlier months unaffected

## Section 03 — Close snapshots

- [ ] **03.1 Close**: close a past month → snapshot row with full report JSONB; page shows closed state
- [ ] **03.2 Double close**: second close attempt (second tab) → "already closed" error, no duplicate row
- [ ] **03.3 Reopen/re-close audit**: reopen, close again → two rows total, first soft-deleted, both retain their numbers
- [ ] **03.4 Future month**: close attempt on a future month → rejected
- [ ] **03.5 Activity**: close + reopen events under `MONTHLY_CLOSE`; invisible to CLIENT-role activity surfaces

## Section 04 — Close UI + drift

- [ ] **04.1 Frozen rendering**: close a month, modify a time log in it → section numbers do NOT move; drift banner appears with correct delta + record attribution
- [ ] **04.2 Late backdated log**: with the month closed, create a log dated inside it → drift `change: 'added'`, hours match
- [ ] **04.3 Soft-delete drift**: archive a closed-month time log → drift `change: 'modified'`, negative delta
- [ ] **04.4 Reopen & re-close**: one click clears the banner; new frozen numbers include the change
- [ ] **04.5 Clean closed month**: no post-close mutations → quiet closed notice, no drift banner
- [ ] **04.6 Current-month close warning**: closing the in-progress month shows the extra warning line
- [ ] **04.7 Navigation**: month arrows work on closed months; open months render live with the Close button

## Section 05 — Guardrails

- [ ] **05.1 Late log warns, saves**: create a time log dated in a closed month → saves; warning toast names the month
- [ ] **05.2 Edit/archive warns**: edit hours on / archive a closed-month log; edit/archive a closed-month hour block → warning each time
- [ ] **05.3 Boundary move**: change a log's date from closed month → open month → warns once; open → open never warns
- [ ] **05.4 No false positives**: normal current-month logging shows no warnings anywhere
- [ ] **05.5 Pre-boundary block purchase**: with a next-month boundary saved (01.5), create an hour block for that client before the boundary → saves with the "won't count toward Billing In" warning; after the boundary month starts, block creates don't warn
- [ ] **05.6 Admin-only warnings**: as a CLIENT-role user in the internal app, log time into a closed month → saves with **no** warning toast; the log still appears as drift on the closed month for admins

## Cross-cutting

- [ ] **X.1** `npm run build && npm run lint && npm run type-check` from repo root pass after each section
- [ ] **X.2** CLIENT-role user: no new surfaces leak (report stays admin-only; no warnings in portal)
- [ ] **X.3** End-to-end for the real switch: change billing type with next-month boundary (01) → log time this month (counts as Net 30) → close this month (03) → next month, buy a 5h block (counts as Prepaid) → prior closed month untouched, no drift
- [ ] **X.4** Grep check: no `clients.billingType` reads remain under `apps/internal/lib/queries/reports/` or `apps/internal/lib/data/reports/` (02 acceptance criterion)
