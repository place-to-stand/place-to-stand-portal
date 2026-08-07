# PRD 002 — Progress

| Section | Status | Notes |
|---------|--------|-------|
| 01 — Terms schema + billing change flow | Not started | Closed-month guard behind stub until 03 |
| 02 — Temporal resolution in close queries | Not started | Unblocks the first client's switch |
| 03 — `monthly_close_snapshots` + actions | Not started | Independent of 01/02 |
| 04 — Close workflow UI + drift banner | Not started | Requires 02 + 03 |
| 05 — Late-entry guardrails | Not started | Requires 02 + 03 |

## Pre-implementation checklist (from ARCHITECTURE-REVIEW.md)

- [ ] 01: restructure `createClient`'s slug-retry loop around a `db.transaction` (client + initial term) — W2
- [ ] 01: `upsertBillingTerm` passes `targetWhere: deleted_at IS NULL` for the partial unique index — W3
- [ ] 01: no convert-lead changes — it calls `createClient` (verify via test 01.3) — W1
- [ ] 03/04: convert the 0-indexed URL month to 1-indexed before calling close actions — W4
- [ ] 03: add `MONTHLY_CLOSE` to `VALID_TARGET_TYPES` in the activity API route (admin filter), NOT to `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES` — I1/D11
- [ ] 05: time-log warnings go in the API route JSON responses (no actions dir exists) and are computed for ADMIN users only — C1/I4
- [ ] 01: `hour_blocks.billing_month` column + shared resolver used by BOTH the Stripe webhook path (`createHourBlocksFromInvoice`) and manual saves — F7/D13
- [ ] 01: closed-month guard runs inside the term-update transaction — F5
- [ ] 01: migration preflight asserts no data predates the 2000-01-01 sentinel — F10
- [ ] 02: prepaid queries + `fetchReportDateBounds` count blocks by `billing_month` — F7
- [ ] 03: capture `closed_at` before deriving; derive + insert in one transaction; re-close is an atomic swap — F3/F4
- [ ] 03: `parseSnapshotReport` zod-validates; unknown version → "snapshot unreadable" state — F9
- [ ] 04: drift = canonical comparison (hours + dollars + per-payee rows), not section hours only — F2
- [ ] 04: `updateTimeLog`/`softDeleteTimeLog` must start setting `updatedAt`; drift also checks `deleted_at` — F1
- [ ] 05: time-log PATCH captures the prior `logged_on` before mutating — F6

## Log

- 2026-08-06 — PRD drafted from working session (billing-type switch for first net_30 → prepaid client; future-proofing monthly close history).
- 2026-08-06 — Consistency check: cut future-dated scheduling + cron (changes apply at save, D10), removed drift-banner dismiss, 5h minimum out of scope, added pre-boundary purchase warning.
- 2026-08-06 — Trimmed: billing change flow folded into 01, sections renumbered (old 04–07 → 03–06), narrative stripped to implementation content.
- 2026-08-06 — Audit (ARCHITECTURE-REVIEW.md): C1 time-log warnings moved to API routes; W1 convert-lead inherits createClient's term insert; W2 transaction-in-retry-loop; W3 partial-index targetWhere; W4 month indexing; W5 in-sheet history list dropped; I4 warnings admin-only; PW1/PW2 block balances + depletion alerts recorded as recommended next PRD; PW3 radio relabeled "New billing starts:".
- 2026-08-06 — Multi-reviewer pass on PR #102 (Claude + Codex standard + Codex adversarial): 10 unique findings, all triaged with owner. Headline: F7 (confirmed) — Stripe-webhook-created blocks could orphan revenue pre-boundary → new `hour_blocks.billing_month` attribution (D13); F1 `updatedAt` never bumped on time-log edits; F2 drift now compares dollars/payees, not hours only; F3/F4/F5/F6 transactional/race fixes; F9 zod snapshot decode; F10 backfill preflight. See ARCHITECTURE-REVIEW.md "Multi-reviewer pass".
