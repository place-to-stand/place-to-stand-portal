# PRD 001 — Manual Test Plan

Update after each coding session. Check items only after verifying in the running app.

## Prerequisites

- [x] Migration `form_submission_acknowledgement` (`0054`) applied to the local DB (`npm run db:migrate` with `DATABASE_URL` set)
- [x] Internal app running on **:3000**; client app (:3001) not required for this PRD
- [ ] Admin account available; one CLIENT-role account available for permission checks <!-- seeded locally: autotest@local.test (ADMIN), client@test.local (CLIENT) — sign-in is a human step -->
- [x] Seed rows in `form_submissions` covering every cell of the matrix (6 rows: contact; audit in_progress/abandoned/completed/captured unacked; captured acked)
- [ ] A way to fire the intake webhook locally for beacon tests (POST to `/api/integrations/audit-responses` with the bearer token from env) — needed for D8 and archive-beacon cases <!-- MANUAL STEP for the user: AUDIT_INTAKE_TOKEN is not in apps/internal/.env.local — add it (any value, matching the request header) to exercise the HTTP intake path; D8 semantics were already verified at the SQL level -->

## 01 — Schema & migration (7)

- [x] Migration applies cleanly on a DB at baseline `0053`; re-running `db:migrate` is a no-op (verified 2026-08-03)
- [x] All pre-existing non-deleted rows have `acknowledged_at` set post-migration (badge starts at 0) — vacuously true locally (table was empty); backfill statement present in `0054`
- [x] `idx_form_submissions_unread` exists (`\d form_submissions`) with predicate `deleted_at IS NULL AND acknowledged_at IS NULL` (verified)
- [x] Generated SQL contains no `POLICY` / `ROW LEVEL SECURITY` statements (verified)
- [x] D8: acknowledge a `completed` audit, then advance it to `captured` → `acknowledged_at` is NULL again (verified via SQL replication of the upsert; HTTP-path re-check needs AUDIT_INTAKE_TOKEN, see prerequisites)
- [x] Stale beacon (older `last_activity_at`) against an acknowledged row → acknowledgement unchanged (verified — setWhere gate discarded the write entirely)
- [x] Same-status beacon (no advance) against an acknowledged row → acknowledgement unchanged (verified)

## 02 — Page shell & tabs (8)

- [ ] `/submissions`, `/submissions/archive`, `/submissions/activity` render; tabs switch routes; active tab highlights correctly on each
- [ ] Card styling matches hour blocks (`bg-background rounded-xl border p-6 shadow-sm`); filters + count sit in the tabs row, right side
- [ ] Kind filter, status filter, and combined filters return correct rows; changing a filter resets to page 1
- [ ] Pagination works with filters applied; URL reflects page + filters (deep-linkable)
- [ ] Row click opens the detail sheet with full data (regression)
- [ ] Browser back/forward navigates tab and filter states correctly
- [ ] CLIENT-role user navigating to each of the three routes directly by URL gets the unauthorized flow (the sidebar link itself is hidden for them once 06/D10 lands)
- [ ] Sidebar "Submissions" shows active state on all three routes

## 03 — Acknowledge & unread (13)

- [ ] Unread dot + medium font on: unacknowledged contact (any status), unacknowledged audit `completed`, unacknowledged audit `captured`
- [ ] No indicator on: unacknowledged audit `in_progress`, unacknowledged audit `abandoned`, any acknowledged row
- [ ] Row Acknowledge button visible only on unread rows; clicking it does NOT open the sheet; indicator clears without full reload
- [ ] Opening and closing the sheet without clicking Acknowledge leaves the row unread (D2)
- [ ] Sheet shows Unread badge + Acknowledge for unread; `Acknowledged {relative time}` after
- [ ] Acknowledging from the sheet keeps the sheet open and updates its state (optimistic)
- [ ] Rapid double-click on Acknowledge → single acknowledgement, no error toast
- [ ] Two browser sessions acknowledging the same row → first wins, second sees no error, `acknowledged_by` is the first user
- [ ] Action rejected for CLIENT role (direct invocation) and for a malformed/unknown UUID (friendly error)
- [ ] D8 follow-through: the re-flagged row from test 01-D8 shows the unread indicator again in the table
- [ ] PW1: Unread filter (`?unread=1`) shows exactly the D1-unread rows; composes with kind/status (`unread=1&kind=audit`); resets to page 1; clearing it restores the full list
- [ ] PW1: Unread filter control is absent on the Archive tab
- [ ] PW2: clicking the email in the detail sheet opens the mail client (`mailto:` with the correct address)

## 04 — Archive & restore (10)

- [ ] Archive from row action opens confirm dialog; cancel does nothing; confirm removes the row from List
- [ ] Archive from detail sheet works and closes the sheet (D9); Restore from the sheet also closes it
- [ ] Archived row appears on the Archive tab with an Archived relative-time column; filters + pagination work there
- [ ] Restore (no confirm) returns the row to List; prior acknowledged/unread state preserved
- [ ] Archived rows show no unread indicator and no Acknowledge affordance (table + sheet)
- [ ] Double-click archive → one state change, no error; same for restore
- [ ] Restoring an already-active row / archiving an unknown id → friendly error
- [ ] Late beacon POSTed for an archived audit session → row stays archived (does not resurface on List)
- [ ] Empty states: List with everything archived → "No submissions yet."; Archive with nothing archived → "No archived submissions."
- [ ] No hard-delete affordance anywhere in the UI

## 05 — Activity (9)

- [ ] Acknowledge, archive, restore each produce one feed entry with actor, correct verb summary, and relative time
- [ ] Summary uses contact name/email when present; "anonymous audit submission" otherwise
- [ ] Idempotent no-op paths (double-clicks) add no duplicate entries
- [ ] `/submissions/activity` lists entries newest-first; pagination/load-more works past 20 entries
- [ ] Empty state renders on a fresh DB
- [ ] Hour-blocks activity feed unaffected (regression — target-type filtering)
- [ ] Activity route (page) admin-gated
- [ ] C1: admin fetch of `/api/activity?targetType=SUBMISSION` returns 200 with logs (whitelist entry works)
- [ ] W1: CLIENT-role fetch of `/api/activity?targetType=SUBMISSION` returns 403; CLIENT fetch of another permitted type still behaves as before

## 06 — Nav badge (9)

- [ ] Badge shows correct count for the seed matrix (contact + completed + captured unacknowledged only)
- [ ] No pill when count is 0; `99+` when > 99 (seed via SQL loop)
- [ ] Acknowledging decrements on next render without a manual hard refresh
- [ ] Archiving an unread row decrements; restoring re-increments
- [ ] Acknowledging an `in_progress` row (if forced via SQL) does not change the count — predicate parity check
- [ ] CLIENT-role sidebar: Submissions item absent entirely (D10), no badge, no layout error
- [ ] D8 end-to-end: `captured` beacon on an acknowledged row increments the badge on next navigation
- [ ] Screen reader (VoiceOver) announces "Submissions … unread" on the nav link
- [ ] Admin sidebar still shows Submissions with correct active state after the D10 roles change (regression on the roles filter)

## Regression checks — adjacent features (7)

- [ ] Intake webhook: full audit beacon lifecycle (in_progress → completed → captured) still upserts one row with correct field coalescing
- [ ] Contact-form intake still creates a one-shot row
- [ ] Hour Blocks list / archive / activity tabs unaffected (shared patterns, no shared code — but verify)
- [ ] Leads board and leads archive unaffected
- [ ] Sidebar renders correctly for both roles on unrelated routes (badge plumbing didn't break nav)
- [ ] `activity_overview_cache` / dashboard activity highlights still render (new SUBMISSION verbs don't break aggregation)
- [ ] Activity tenant isolation after reassignment: as admin, move a project from client A to client B (settings → projects); a client-A member can no longer read that project's task/project activity via `/api/activity` (old rows carry A's stale `target_client_id` — project-first authorization must win); a client-B member now can

## Summary

| Section | Tests |
|---------|-------|
| 01 Schema & migration | 7 |
| 02 Page shell & tabs | 8 |
| 03 Acknowledge & unread | 13 |
| 04 Archive & restore | 10 |
| 05 Activity | 9 |
| 06 Nav badge | 9 |
| Regression | 7 |
| **Total** | **63** |
