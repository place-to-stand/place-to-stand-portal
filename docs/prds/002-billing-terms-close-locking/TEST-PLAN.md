# PRD 002 — Manual Test Plan

All tests run as an ADMIN user in `apps/internal/`. "The report" = `/reports/monthly-close`.

## Section 01 — Terms schema + billing change flow

- [x] **01.1 Backfill integrity**: after migration, every client (active + archived) has exactly one terms row at `effective_from = '2000-01-01'` <!-- verified locally 2026-08-07: 1 client → 1 backfill row -->

- [x] **01.2 New client (settings sheet)**: create a client → terms row with `effective_from` = first of current month, `created_by` = you <!-- auto-tested -->
- [ ] **01.3 New client (lead conversion)**: convert a lead → same as 01.2 <!-- manual: lead-convert dialog opens via dnd-kit drag to Closed Won — not automatable; code path (createClient) verified via 01.2 -->
- [x] **01.4 Constraints**: direct SQL insert with `effective_from = '2026-08-15'` fails the CHECK; duplicate active `(client_id, effective_from)` fails the unique index <!-- verified locally 2026-08-07 via SQL probes -->

- [x] **01.5 Next-month boundary (default)**: change billing type, keep "Next month" → sheet, client list, and invoice defaults show the new type **immediately**; current month's report keeps the old basis; next month uses the new basis; the change appears in the activity feed with `effectiveFrom` <!-- auto-tested -->
- [x] **01.6 This-month boundary**: choose "This month" → current month's report re-derives on the new basis <!-- auto-tested -->
- [x] **01.7 Change of mind**: before the boundary, switch the type back → same boundary row overwritten, report and cache match the original state <!-- auto-tested -->
- [x] **01.8 Closed-month block**: close the current month (03), then attempt "This month" → blocked with the reopen-first error <!-- auto-tested -->
- [x] **01.9 Activity**: exactly one billing-type change entry per save, with before/after and `effectiveFrom` in details <!-- auto-tested -->

## Section 02 — Temporal resolution

- [x] **02.1 Zero-drift regression**: record Billing In / Total Payouts / per-section hours for 3 historical months before deploying. After deploy with only backfill rows: identical values <!-- auto-tested -->
- [x] **02.2 The real switch**: give the switching client a `prepaid` term effective first of next month. Past + current months: still Net 30, hours unchanged. Next month: under Prepaid (0h until a block is purchased) <!-- auto-tested -->
- [x] **02.3 Basis follows everywhere**: origination and closer breakdowns show the client under the correct basis on both sides of the boundary <!-- auto-tested -->
- [x] **02.4 Purchased block after cutover**: create an hour block in the cutover month → appears in that month's Prepaid billing; earlier months unaffected <!-- auto-tested -->
- [x] **02.5 Pre-boundary purchase (F7)**: with a next-month boundary saved, create a block before the boundary (manual save, and simulated webhook via a paid prepaid invoice) → `billing_month` = boundary month; block appears in the boundary month's Billing In, not the creation month's <!-- auto-tested -->

## Section 03 — Close snapshots

- [x] **03.1 Close**: close a past month → snapshot row with full report JSONB; page shows closed state <!-- auto-tested -->
- [x] **03.2 Double close**: second close attempt (second tab) → "already closed" error, no duplicate row <!-- auto-tested -->
- [x] **03.3 Reopen/re-close audit**: reopen, close again → two rows total, first soft-deleted, both retain their numbers <!-- auto-tested -->
- [x] **03.4 Future month**: close attempt on a future month → rejected <!-- auto-tested -->
- [x] **03.5 Activity**: close + reopen events under `MONTHLY_CLOSE`; invisible to CLIENT-role activity surfaces <!-- auto-tested -->

## Section 04 — Close UI + drift

- [x] **04.1 Frozen rendering**: close a month, modify a time log in it → section numbers do NOT move; drift banner appears with correct delta + record attribution <!-- auto-tested -->
- [x] **04.2 Late backdated log**: with the month closed, create a log dated inside it → drift `change: 'added'`, hours match <!-- auto-tested -->
- [x] **04.3 Soft-delete drift**: archive a closed-month time log → drift `change: 'deleted'`, negative delta (requires the F1 `updatedAt`/`deleted_at` fixes) <!-- auto-tested -->
- [x] **04.3b Payee drift (F2)**: in a closed month, reassign hours between users or swap the client's closer → drift banner appears even though section hour totals are unchanged <!-- auto-tested -->
- [ ] **04.3c Failed re-close keeps the snapshot (F3)**: force a re-close derivation failure (e.g. temporarily throw) → original snapshot still active, month still closed <!-- manual: requires fault injection into recloseMonth derivation — see MANUAL-TEST-PLAN Section B -->
- [x] **04.4 Reopen & re-close**: one click clears the banner; new frozen numbers include the change <!-- auto-tested -->
- [x] **04.5 Clean closed month**: no post-close mutations → quiet closed notice, no drift banner <!-- auto-tested -->
- [x] **04.6 Current-month close warning**: closing the in-progress month shows the extra warning line <!-- auto-tested -->
- [x] **04.7 Navigation**: month arrows work on closed months; open months render live with the Close button <!-- auto-tested -->

## Section 05 — Guardrails

- [x] **05.1 Late log warns, saves**: create a time log dated in a closed month → saves; warning toast names the month <!-- auto-tested -->
- [x] **05.2 Edit/archive warns**: edit hours on / archive a closed-month log; edit/archive a closed-month hour block → warning each time <!-- auto-tested -->
- [x] **05.3 Boundary move**: change a log's date from closed month → open month → warns once; open → open never warns <!-- auto-tested -->
- [x] **05.4 No false positives**: normal current-month logging shows no warnings anywhere <!-- auto-tested -->
- [x] **05.5 Pre-boundary block purchase**: with a next-month boundary saved (01.5), create an hour block for that client → saves with `billing_month` = boundary month and the informational "billed in [Month]" note; no warning after the boundary month starts <!-- auto-tested -->
- [x] **05.6 Admin-only warnings**: as a CLIENT-role user in the internal app, log time into a closed month → saves with **no** warning toast; the log still appears as drift on the closed month for admins <!-- auto-tested -->

## Cross-cutting

- [x] **X.1** `npm run build && npm run lint && npm run type-check` from repo root pass after each section <!-- verified 2026-08-07: all three green on the final tree -->

- [x] **X.2** CLIENT-role user: no new surfaces leak (report stays admin-only; no warnings in portal) <!-- auto-tested -->
- [x] **X.3** End-to-end for the real switch: change billing type with next-month boundary (01) → log time this month (counts as Net 30) → close this month (03) → next month, buy a 5h block (counts as Prepaid) → prior closed month untouched, no drift <!-- auto-tested -->
- [x] **X.4** Grep check: no `clients.billingType` reads remain under `apps/internal/lib/queries/reports/` or `apps/internal/lib/data/reports/` (02 acceptance criterion) <!-- verified 2026-08-07: zero matches -->

