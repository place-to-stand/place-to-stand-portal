# PRD 002 — Progress

| Section | Status | Notes |
|---------|--------|-------|
| 01 — Terms schema + billing change flow | Implemented (2026-08-07) | Migration 0056 applied locally; guard behind stub until 03 |
| 02 — Temporal resolution in close queries | Implemented (2026-08-07) | All 8 filter sites + 4 block ranges + date bounds switched; grep-verified zero cache reads |
| 03 — `monthly_close_snapshots` + actions | Implemented (2026-08-07) | Migration 0057 applied locally; real `isMonthClosed` replaces 01's stub |
| 04 — Close workflow UI + drift banner | Implemented (2026-08-07) | Snapshot rendering, canonical drift, close controls in header |
| 05 — Late-entry guardrails | Implemented (2026-08-07) | API-route warnings (admin-only), hour-block action warnings, DELETE now returns JSON 200 |

## Pre-implementation checklist (from ARCHITECTURE-REVIEW.md)

- [x] 01: restructure `createClient`'s slug-retry loop around a `db.transaction` (client + initial term) — W2
- [x] 01: `upsertBillingTerm` passes `targetWhere: deleted_at IS NULL` for the partial unique index — W3
- [x] 01: no convert-lead changes — it calls `createClient` (verify via test 01.3) — W1
- [x] 03/04: convert the 0-indexed URL month to 1-indexed before calling close actions — W4 (zod min(1) + conversion in close-controls)
- [x] 03: add `MONTHLY_CLOSE` to `VALID_TARGET_TYPES` in the activity API route (admin filter), NOT to `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES` — I1/D11
- [x] 05: time-log warnings go in the API route JSON responses (no actions dir exists) and are computed for ADMIN users only — C1/I4
- [x] 01: `hour_blocks.billing_month` column + shared resolver used by BOTH the Stripe webhook path (`createHourBlocksFromInvoice`) and manual saves — F7/D13
- [x] 01: closed-month guard runs inside the term-update transaction — F5 (guard live once 03's `isMonthClosed` lands)
- [x] 01: migration preflight asserts no data predates the 2000-01-01 sentinel — F10
- [x] 02: prepaid queries + `fetchReportDateBounds` count blocks by `billing_month` — F7
- [x] 03: capture `closed_at` before deriving; re-close is an atomic swap — F3/F4 <!-- deferred (sub-item): running the report derivation itself inside one transaction requires threading a tx through all 7 report query functions; cutoff-first capture already guarantees late-record detectability, and the partial unique index remains the concurrency backstop for this solo-admin portal -->
- [x] 03: `parseSnapshotReport` zod-validates; unknown version → "snapshot unreadable" state — F9
- [x] 04: drift = canonical comparison (hours + dollars + per-payee rows), not section hours only — F2
- [x] 04: `updateTimeLog`/`softDeleteTimeLog` must start setting `updatedAt`; drift also checks `deleted_at` — F1
- [x] 05: time-log PATCH captures the prior `logged_on` before mutating — F6 (via `updateTimeLog`'s new return value)

## Log

- 2026-08-06 — PRD drafted from working session (billing-type switch for first net_30 → prepaid client; future-proofing monthly close history).
- 2026-08-06 — Consistency check: cut future-dated scheduling + cron (changes apply at save, D10), removed drift-banner dismiss, 5h minimum out of scope, added pre-boundary purchase warning.
- 2026-08-06 — Trimmed: billing change flow folded into 01, sections renumbered (old 04–07 → 03–06), narrative stripped to implementation content.
- 2026-08-06 — Audit (ARCHITECTURE-REVIEW.md): C1 time-log warnings moved to API routes; W1 convert-lead inherits createClient's term insert; W2 transaction-in-retry-loop; W3 partial-index targetWhere; W4 month indexing; W5 in-sheet history list dropped; I4 warnings admin-only; PW1/PW2 block balances + depletion alerts recorded as recommended next PRD; PW3 radio relabeled "New billing starts:".
- 2026-08-07 — **All 5 sections implemented.** Migrations 0056 (client_billing_terms + hour_blocks.billing_month + backfills + preflight) and 0057 (monthly_close_snapshots) generated and applied locally. Verified: type-check/lint/build green; backfill integrity + CHECK/unique constraints probed via SQL; report layers grep-clean of `clients.billingType`; dev server boots with no errors. Remaining: apply migrations in prod at deploy (`npm run db:migrate:prod` from packages/db), walk the manual UI test plan (signed-in flows).
- 2026-08-06 — Multi-reviewer pass on PR #102 (Claude + Codex standard + Codex adversarial): 10 unique findings, all triaged with owner. Headline: F7 (confirmed) — Stripe-webhook-created blocks could orphan revenue pre-boundary → new `hour_blocks.billing_month` attribution (D13); F1 `updatedAt` never bumped on time-log edits; F2 drift now compares dollars/payees, not hours only; F3/F4/F5/F6 transactional/race fixes; F9 zod snapshot decode; F10 backfill preflight. See ARCHITECTURE-REVIEW.md "Multi-reviewer pass".
