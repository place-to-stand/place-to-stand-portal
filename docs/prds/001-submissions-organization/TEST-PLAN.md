# PRD 001 — Manual Test Plan

Update after each coding session. Check items only after verifying in the running app.

> **Autotest run 2026-08-03:** all items below were exercised by `/autotest-prd` (agent-browser + SQL fixture flips + HTTP intake beacons) except the three tagged `manual:`. See [MANUAL-TEST-PLAN.md](MANUAL-TEST-PLAN.md) for the human follow-up pass.

## Prerequisites

- [x] Migration `form_submission_acknowledgement` (`0054`) applied to the local DB (`npm run db:migrate` with `DATABASE_URL` set) <!-- auto-tested -->
- [x] Internal app running on **:3000**; client app (:3001) not required for this PRD <!-- auto-tested -->
- [x] Admin account available; one CLIENT-role account available for permission checks (autotest@local.test / client@test.local — both signed in via agent-browser) <!-- auto-tested -->
- [x] Seed rows in `form_submissions` covering every cell of the matrix (6 rows: contact; audit in_progress/abandoned/completed/captured unacked; captured acked) <!-- auto-tested -->
- [x] A way to fire the intake webhook locally for beacon tests — `AUDIT_INTAKE_TOKEN` + `CONTACT_INTAKE_TOKEN` added to `apps/internal/.env.local` (local autotest values); full beacon lifecycle exercised over HTTP <!-- auto-tested -->

## 01 — Schema & migration (7)

- [x] Migration applies cleanly on a DB at baseline `0053`; re-running `db:migrate` is a no-op <!-- auto-tested -->
- [x] All pre-existing non-deleted rows have `acknowledged_at` set post-migration (badge starts at 0) — vacuously true locally (table was empty); backfill statement present in `0054` <!-- auto-tested -->
- [x] `idx_form_submissions_unread` exists (`\d form_submissions`) with predicate `deleted_at IS NULL AND acknowledged_at IS NULL` <!-- auto-tested -->
- [x] Generated SQL contains no `POLICY` / `ROW LEVEL SECURITY` statements <!-- auto-tested -->
- [x] D8: acknowledge a `completed` audit, then POST a `captured` beacon for its `session_key` → `acknowledged_at` is NULL again — verified BOTH via SQL replication AND the real HTTP intake route <!-- auto-tested -->
- [x] Stale beacon (older `last_activity_at`) against an acknowledged row → acknowledgement unchanged (SQL + HTTP: stale abandoned beacon discarded entirely) <!-- auto-tested -->
- [x] Same-status beacon (no advance) against an acknowledged row → acknowledgement unchanged <!-- auto-tested -->

## 02 — Page shell & tabs (8)

- [x] `/submissions`, `/submissions/archive`, `/submissions/activity` render; tabs switch routes; active tab highlights correctly on each <!-- auto-tested -->
- [x] Card styling matches hour blocks (`bg-background rounded-xl border p-6 shadow-sm`); filters + count sit in the tabs row, right side (DOM query confirmed the exact class set) <!-- auto-tested -->
- [x] Kind filter, status filter, and combined filters return correct rows (`kind=audit&status=captured` → 2); changing a filter resets to page 1 <!-- auto-tested -->
- [x] Pagination works with filters applied; URL reflects page + filters (deep-linkable; page 2 = 11 rows of 36) <!-- auto-tested -->
- [x] Row click opens the detail sheet with full data (regression — contact fields, audit answers 10/10 render) <!-- auto-tested -->
- [x] Browser back/forward navigates tab and filter states correctly <!-- auto-tested -->
- [x] CLIENT-role user navigating to each of the three routes directly by URL gets the unauthorized flow (all three → /unauthorized) <!-- auto-tested -->
- [x] Sidebar "Submissions" shows active state on all three routes (`aria-current=page` verified on /archive and /activity) <!-- auto-tested -->

## 03 — Acknowledge & unread (13)

- [x] Unread dot + medium font on: unacknowledged contact (any status), unacknowledged audit `completed`, unacknowledged audit `captured` <!-- auto-tested -->
- [x] No indicator on: unacknowledged audit `in_progress`, unacknowledged audit `abandoned`, any acknowledged row <!-- auto-tested -->
- [x] Row Acknowledge button visible only on unread rows; clicking it does NOT open the sheet; indicator clears without full reload <!-- auto-tested -->
- [x] Opening and closing the sheet without clicking Acknowledge leaves the row unread (D2 — Escape-closed, badge unchanged) <!-- auto-tested -->
- [x] Sheet shows Unread badge + Acknowledge for unread; `Acknowledged {relative time}` after ("Acknowledged just now") <!-- auto-tested -->
- [x] Acknowledging from the sheet keeps the sheet open and updates its state (optimistic; D9) <!-- auto-tested -->
- [x] Rapid double-click on Acknowledge → single acknowledgement, no error toast (2 clicks fired, exactly 1 activity log, 0 error toasts) <!-- auto-tested -->
- [x] Two browser sessions acknowledging the same row → first wins, second sees no error, `acknowledged_by` is the first user (SQL: conditional UPDATE second run = 0 rows, first reviewer retained) <!-- auto-tested -->
- [ ] Action rejected for CLIENT role (direct invocation) and for a malformed/unknown UUID (friendly error) <!-- manual: see MANUAL-TEST-PLAN Section B — requires crafting a Next server-action POST; assertAdmin + zod guards verified in source, and CLIENT users cannot reach any UI that invokes the action -->
- [x] D8 follow-through: the re-flagged row shows the unread indicator again in the table (Http Probe row Unread after captured beacon) <!-- auto-tested -->
- [x] PW1: Unread filter (`?unread=1`) shows exactly the D1-unread rows; composes with kind/status (`unread=1&kind=audit`); resets to page 1; clearing it restores the full list <!-- auto-tested -->
- [x] PW1: Unread filter control is absent on the Archive tab (only kind/status comboboxes render there) <!-- auto-tested -->
- [x] PW2: the email in the detail sheet is a `mailto:` link with the correct address (href verified: mailto:casey@example.com) <!-- auto-tested -->

## 04 — Archive & restore (10)

- [x] Archive from row action opens confirm dialog; cancel does nothing; confirm removes the row from List (36 → 35) <!-- auto-tested -->
- [x] Archive from detail sheet works and closes the sheet (D9); Restore from the sheet also closes it <!-- auto-tested -->
- [x] Archived row appears on the Archive tab with an Archived relative-time column; filters + pagination work there (30 rows flipped archived: Page 2 present, status filter applied) <!-- auto-tested -->
- [x] Restore (no confirm) returns the row to List; prior acknowledged/unread state preserved (unread completed row survived archive→restore round trip) <!-- auto-tested -->
- [x] Archived rows show no unread indicator and no Acknowledge affordance (table + sheet) <!-- auto-tested -->
- [x] Double-click archive → one state change, no error; same for restore (SQL direction guards: second UPDATE = 0 rows) <!-- auto-tested -->
- [ ] Restoring an already-active row / archiving an unknown id → friendly error <!-- manual: see MANUAL-TEST-PLAN Section B — friendly-error strings live in the server action, which needs a crafted direct invocation; the underlying mutation guards were SQL-verified (restore-on-active and double-archive both no-op) -->
- [x] Late beacon POSTed for an archived audit session → row stays archived (verified over real HTTP and via SQL replica) <!-- auto-tested -->
- [x] Empty states: List with everything archived → "No submissions yet."; Archive with nothing archived → "No archived submissions." <!-- auto-tested -->
- [x] No hard-delete affordance anywhere in the UI <!-- auto-tested -->

## 05 — Activity (9)

- [x] Acknowledge, archive, restore each produce one feed entry with actor, correct verb summary, and relative time (6 UI actions = exactly 6 log rows) <!-- auto-tested -->
- [x] Summary uses contact name/email when present; "anonymous audit submission" otherwise <!-- auto-tested -->
- [x] Idempotent no-op paths (double-clicks) add no duplicate entries <!-- auto-tested -->
- [x] `/submissions/activity` lists entries newest-first; pagination/load-more works past 20 entries (25 seeded rows: 20 shown → Load more → more rendered) <!-- auto-tested -->
- [x] Empty state renders on a fresh DB (SUBMISSION logs soft-deleted → "No recent submission activity.", reverted) <!-- auto-tested -->
- [x] Hour-blocks activity feed unaffected (regression — target-type filtering; renders its own heading/empty state) <!-- auto-tested -->
- [x] Activity route (page) admin-gated (CLIENT → /unauthorized) <!-- auto-tested -->
- [x] C1: admin fetch of `/api/activity?targetType=SUBMISSION` returns 200 with logs (whitelist entry works) <!-- auto-tested -->
- [x] W1: CLIENT-role fetch of `/api/activity?targetType=SUBMISSION` returns 403; CLIENT fetch of another permitted type still behaves as before (SUBMISSION + LEAD forbidden; TASK returns their scoped logs) <!-- auto-tested -->

## 06 — Nav badge (9)

- [x] Badge shows correct count for the seed matrix (contact + completed + captured unacknowledged only = 3) <!-- auto-tested -->
- [x] No pill when count is 0; `99+` when > 99 (120 seeded → visible pill "99+", sr-only "(121 unread)"; 0 → no pill) <!-- auto-tested -->
- [x] Acknowledging decrements on next render without a manual hard refresh (3→2→1 observed live) <!-- auto-tested -->
- [x] Archiving an unread row decrements; restoring re-increments (1→0→1 observed live) <!-- auto-tested -->
- [x] Acknowledging an `in_progress` row (forced via SQL) does not change the count — predicate parity check (count 3 before and after) <!-- auto-tested -->
- [x] CLIENT-role sidebar: Submissions item absent entirely (D10), no badge, no layout error <!-- auto-tested -->
- [x] D8 end-to-end: `captured` beacon on an acknowledged row increments the badge on next navigation (1→2 observed after HTTP beacon) <!-- auto-tested -->
- [ ] Screen reader (VoiceOver) announces "Submissions … unread" on the nav link <!-- manual: see MANUAL-TEST-PLAN Section B — needs real assistive tech; the sr-only text "(N unread)" is present in the accessibility tree (accessible name verified as "Submissions (3 unread)") -->
- [x] Admin sidebar still shows Submissions with correct active state after the D10 roles change (regression on the roles filter) <!-- auto-tested -->

## Regression checks — adjacent features (7)

- [x] Intake webhook: full audit beacon lifecycle (in_progress → completed → captured) still upserts one row with correct field coalescing (real HTTP POSTs; UTM + contact preserved through status advances) <!-- auto-tested -->
- [x] Contact-form intake still creates a one-shot row (HTTP POST → captured contact row) <!-- auto-tested -->
- [x] Hour Blocks list / archive / activity tabs unaffected (all three render) <!-- auto-tested -->
- [x] Leads board and leads archive unaffected (both render) <!-- auto-tested -->
- [x] Sidebar renders correctly for both roles on unrelated routes (badge plumbing didn't break nav; admin + client sessions verified) <!-- auto-tested -->
- [x] `activity_overview_cache` / dashboard activity highlights still render (admin home widget shows metrics + highlight) <!-- auto-tested -->
- [x] Activity tenant isolation after reassignment: as admin, move a project from client A to client B (settings → projects); a client-A member can no longer read that project's task/project activity via `/api/activity` (old rows carry A's stale `target_client_id` — project-first authorization must win); a client-B member now can (live flip with the signed-in CLIENT session: logs [] after reassignment, restored after revert) <!-- auto-tested -->

## Summary

| Section | Tests | Auto-tested | Manual |
|---------|-------|-------------|--------|
| Prerequisites | 5 | 5 | 0 |
| 01 Schema & migration | 7 | 7 | 0 |
| 02 Page shell & tabs | 8 | 8 | 0 |
| 03 Acknowledge & unread | 13 | 12 | 1 |
| 04 Archive & restore | 10 | 9 | 1 |
| 05 Activity | 9 | 9 | 0 |
| 06 Nav badge | 9 | 8 | 1 |
| Regression | 7 | 7 | 0 |
| **Total** | **68** | **65** | **3** |
