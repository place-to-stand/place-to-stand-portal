# PRD 003 — Manual Test Plan

Update after each coding session. All tests run as an **ADMIN** user in the internal portal unless
stated otherwise (the internal portal is admin-only; CLIENT sessions are redirected to the client
portal at sign-in — application-layer access control, no RLS).

## Prerequisites

- [x] Internal app running on **:3000** (`npm run dev` from repo root or `apps/internal/`)
- [x] Database migrated through this PRD's `remove_sow_tables` migration (for §03 tests)
- [x] Seed state: ≥1 client with a mix of ACTIVE/ONBOARDING **and** ON_HOLD/COMPLETED projects, plus ≥1 soft-deleted project; ≥1 prepaid client with a low remaining-hours balance (overage test); ≥1 net_30 client; a project with a linked GitHub repo (Planning test); ≥1 ADMIN and ≥1 CLIENT user, one of them disabled (`disabled_at` set); ≥1 archived user; >20 users total if pagination is to be exercised
- [x] A closed month exists (PRD 002) if verifying the closed-month time-log warning passthrough

## §01 — Task sheet stays open (12)

- [x] **01.1** My Tasks → Add task → fill → Save: sheet stays open, header flips to "Edit task", URL is `/my/tasks/board/{taskId}`, "Task created" toast fires <!-- auto-tested -->
- [x] **01.2** Immediately after 01.1, the Planning toggle is enabled (project has GitHub repos) and the panel opens <!-- auto-tested -->
- [x] **01.3** Immediately after 01.1, Save again without changes → updates (no duplicate task on the board) <!-- auto-tested -->
- [ ] **01.4** Rapid double-click Save (or ⌘S twice fast) during create → exactly one task created <!-- manual: see MANUAL-TEST-PLAN Section B -->
- [x] **01.5** Project board → create task → sheet stays open in edit mode, URL gains task id <!-- auto-tested -->
- [x] **01.6** Edit an existing task → Save (button) and ⌘S → sheet stays open both times; closing right after does NOT prompt to discard <!-- auto-tested -->
- [x] **01.7** Edit, make a change, close without saving → discard prompt still appears <!-- auto-tested -->
- [x] **01.8** Archive a task from the sheet → sheet closes (unchanged) <!-- auto-tested -->
- [x] **01.9** Lead sheet → task overlay → create task → overlay still closes on save <!-- auto-tested -->
- [x] **01.10** After create/edit save, board and My Tasks lists show the change without manual reload <!-- auto-tested -->
- [ ] **01.11** The create→edit transition shows no flicker of the sheet closing and no transient empty-project form (C2, W15) <!-- manual: see MANUAL-TEST-PLAN Section B -->
- [x] **01.12** After the transition, the description editor shows the saved content; undo history starts fresh (W13 — expected) <!-- auto-tested -->

**Edge cases:**
- [x] **01.E1** Create a task from My Tasks assigned to someone else (not self) → sheet transitions to edit mode showing the task (C1: server page resolves it by id); a second save updates, not duplicates <!-- auto-tested -->
- [x] **01.E2** Create with a validation error (e.g. empty title) → sheet stays open, errors shown, no navigation <!-- auto-tested -->
- [ ] **01.E3** Server error on save (kill network) → toast/error state, sheet open, form intact, retry works; if the failure happened **after** the insert (partial failure), the result carries `taskId` and the sheet transitions to edit — retry never creates a second task (R1) <!-- manual: see MANUAL-TEST-PLAN Section B -->
- [x] **01.E4** Deep link directly to `/my/tasks/board/{taskId}` for a task in a project with none of your assignments → sheet opens in edit mode (C1 by-id resolution) <!-- auto-tested -->
- [x] **01.E5** Deep link `/my/tasks/board/not-a-uuid` → no 500; page renders normally with no sheet (R2) <!-- auto-tested -->

## §02 — Time logs on the task sheet (14)

- [x] **02.1** Open a task with linked time logs → Time section lists them (date, hours, logger, note) with correct total <!-- auto-tested -->
- [x] **02.2** Open a task with none → "No time logged yet" empty state <!-- auto-tested -->
- [x] **02.3** Create mode (before first save) → no Time section <!-- auto-tested -->
- [x] **02.4** After creating a task (01 transition) → Time section appears with empty state <!-- auto-tested -->
- [x] **02.5** "Log time" → dialog opens with the task pre-linked and project fixed → save 1.5h → list + total update without closing/reopening the sheet; task sheet stayed open the whole time <!-- auto-tested -->
- [x] **02.6** In the create dialog, add a second task link → saves; the log then appears on **both** tasks' sheets <!-- auto-tested -->
- [x] **02.7** Click a row → dialog opens in edit mode with values; change hours → save → list updates <!-- auto-tested -->
- [x] **02.8** Delete a log via the dialog's confirm-guarded Delete (W5) → row disappears, total recalculates; the same Delete works when the dialog is opened from the Time Logs tab <!-- auto-tested -->
- [x] **02.9** Prepaid client with low balance: log hours exceeding remaining → overage confirm appears; INTERNAL project or net_30 client → no overage check <!-- auto-tested -->
- [x] **02.10** Change the task's project field WITHOUT saving → "Log time" disabled with tooltip; save (or revert) → re-enabled <!-- auto-tested -->
- [x] **02.11** Same flows from My Tasks specifically (the headline ask): open assigned task → log time → verify <!-- auto-tested -->
- [x] **02.12** "Log time" on an **accepted** task → dialog opens with the task pre-linked (eligibility bypass, C5); saving links correctly <!-- auto-tested -->
- [x] **02.13** "Log time" on an **archived** task's sheet → button disabled with tooltip (C5) <!-- auto-tested -->
- [x] **02.14** Open the pre-linked create dialog, touch nothing, close it → no "Discard time log?" prompt (C5 baseline seeding) <!-- auto-tested -->

**Edge cases:**
- [x] **02.E1** Log 0 or negative hours → dialog validation blocks (existing rule, hours > 0) <!-- auto-tested -->
- [x] **02.E2** Log into a closed month (PRD 002) → warning toast still appears; log saves <!-- auto-tested -->
- [ ] **02.E3** Time-logs API failure → section shows quiet error, rest of the sheet fully usable <!-- manual: see MANUAL-TEST-PLAN Section B -->
- [x] **02.E4** Log time for another user via "Log hours for" → appears in list attributed to them <!-- auto-tested -->
- [x] **02.E5** Another admin edits/deletes a linked log elsewhere → reopening the sheet (or refetch-on-open) shows fresh data <!-- auto-tested -->
- [x] **02.E6** With unsaved task-form edits (e.g. changed title), log time via the dialog → after save, the unsaved title edit is still present in the form (C4) <!-- auto-tested -->
- [x] **02.E7** Archive a linked task in another tab, then save a time log linking it → API rejects with a clear field-level error (R6 server-side validation); accepted tasks still link fine <!-- auto-tested -->

## §03 — Scope removal (8)

- [x] **03.1** Project workspace shows tabs without Scope; switching every remaining tab works <!-- auto-tested -->
- [x] **03.2** Direct URL `/projects/{client}/{project}/scope` → redirects to `.../tasks` <!-- auto-tested -->
- [x] **03.3** Grep sweep clean: no references to `ScopeTabContent`, `sow-status`, `picker-token`, `use-google-picker` outside migrations/PRD docs <!-- verified 2026-08-08, zero hits in apps/ + packages/ .ts/.tsx -->
- [x] **03.4** DB after migrate: `project_sows`, `sow_snapshots`, `sow_sections` tables and `sow_status`, `sow_snapshot_status` types absent; migration ran without FK errors <!-- verified 2026-08-08 against local DB via information_schema/pg_type: 0 tables, 0 types remaining -->
- [ ] **03.5** Google OAuth connect + reconnect (Gmail/Calendar integration settings) still works <!-- manual: see MANUAL-TEST-PLAN Section B -->
- [ ] **03.6** Gmail features (email attachments sync) unaffected (shared `lib/gmail/client.ts` untouched) <!-- manual: see MANUAL-TEST-PLAN Section B -->
- [x] **03.7** Deep links to `/tasks/{taskId}`, `/review`, `/time-logs`, `/activity`, `/archive` all load <!-- auto-tested -->
- [x] **03.8** Build/lint/type-check pass — no orphan imports anywhere (this is the real deletion test) <!-- verified 2026-08-08: npm run build / lint / type-check all green from repo root -->

**Edge cases:**
- [x] **03.E1** Old bookmark with query string `/scope?x=y` → still redirects (params may drop; no 404) <!-- auto-tested -->
- [x] **03.E2** `npm run db:migrate` re-run → idempotent, no error <!-- verified 2026-08-08: second run exits clean -->

## §04 — Total-projects hover (7)

- [x] **04.1** Client with active + non-active projects: "(N total)" shows hover card listing ALL non-deleted projects alphabetically with status badges <!-- auto-tested -->
- [x] **04.2** Items link to `/projects/{slug}/{slug}/tasks`; a COMPLETED project's link loads its board <!-- auto-tested -->
- [x] **04.3** Active-projects hover unchanged (items, links, style) <!-- auto-tested -->
- [x] **04.4** Client where total == active → no "(N total)" affordance (rule unchanged) <!-- auto-tested -->
- [x] **04.5** Client with 0 active but >0 total → zero-active branch shows working total hover <!-- auto-tested -->
- [x] **04.6** Move pointer active-trigger → total-trigger → opening one force-closes the other (W8 coordination); moving into a card keeps it open (200ms close grace) <!-- auto-tested -->
- [x] **04.7** Soft-deleted project appears in neither hover nor either count <!-- auto-tested -->

**Edge cases:**
- [x] **04.E1** Client with many projects (>10) → card scrolls within `max-h-80` (W9), stays usable <!-- auto-tested -->
- [ ] **04.E2** Project with null slug → link uses id fallback and resolves <!-- manual: see MANUAL-TEST-PLAN Section A -->
- [x] **04.E3** Focus the total trigger and press Enter/Space → card opens (I3: activation, not focus — parity with active trigger) <!-- auto-tested -->
- [x] **04.E4** Contacts page linked-clients hover unchanged (hover-card wrapper extension is backward-compatible) <!-- auto-tested -->

## §05 — Users filters (9)

- [x] **05.1** `/settings/users` shows Role + Access dropdowns above the table, styled like submissions <!-- auto-tested -->
- [x] **05.2** Role=Client → only CLIENT users; "Total users" count matches; URL has `?role=CLIENT` <!-- auto-tested -->
- [x] **05.3** Role=Admin → only ADMIN users <!-- auto-tested -->
- [x] **05.4** Access=Disabled → only users with `disabled_at` set; Access=Enabled → the rest <!-- auto-tested -->
- [x] **05.5** Role=Client + Access=Disabled combine (AND) <!-- auto-tested -->
- [x] **05.6** Reload and browser back/forward preserve filter state from the URL <!-- auto-tested -->
- [x] **05.7** With >1 page of results: apply a filter from page 2 → returns to first page (cursor cleared); then paginate → filter persists in URL and results <!-- auto-tested -->
- [x] **05.8** Archive tab: role filter present and working; NO access dropdown <!-- auto-tested -->
- [x] **05.9** Filter matching zero users → filtered empty-state message (not the default empty text) <!-- auto-tested -->

**Edge cases:**
- [x] **05.E1** Hand-typed `?role=SUPERADMIN` or `?access=maybe` → ignored, shows All <!-- auto-tested -->
- [ ] **05.E2** Toggle a user's access switch while `access=enabled` filtered → toggle succeeds with toast; the row disappears **immediately** (the toggle's own `router.refresh()` re-runs the filtered query — expected, W12) <!-- manual: see MANUAL-TEST-PLAN Section A -->
- [x] **05.E3** Stale cursor pasted with a filter (`?cursor=...&role=CLIENT`) → no crash; sane page <!-- auto-tested -->

## Permissions (3)

- [x] **P.1** CLIENT-role user cannot reach any of these pages (redirected to client portal at sign-in — existing behavior intact) <!-- auto-tested -->
- [x] **P.2** Unauthenticated `GET /api/tasks/{taskId}/time-logs` → 401; authenticated ADMIN on a soft-deleted task id → 404 <!-- auto-tested -->
- [x] **P.3** `listUsersForSettings` / clients data fetch still assert admin (spot-check via code review — no route regression) <!-- auto-tested -->

## Regressions (8)

- [x] **R.1** All other sheets still close on save: client, project, user, contact, hour-block, invoice, lead <!-- auto-tested -->
- [x] **R.2** Burndown widget "Add" time-log flow unchanged; Time Logs tab list/edit/delete works — note the edit dialog no longer re-selects previously **unlinked** tasks (C6 deliberate bug fix in the shared hydration path) <!-- auto-tested -->
- [ ] **R.3** Task board drag-and-drop, rank ordering, and assignee ordering unaffected <!-- manual: see MANUAL-TEST-PLAN Section B -->
- [x] **R.4** Submissions page filters still work (pattern source untouched) <!-- auto-tested -->
- [x] **R.5** Contacts page linked-clients hover unchanged (shared HoverCard primitive untouched) <!-- auto-tested -->
- [x] **R.6** Clients page loads with no perf regression (widened query is same round-trip count) <!-- auto-tested -->
- [x] **R.7** Monthly close report + PRD 002 close/drift flows unaffected (time-log write paths only gained a callback) <!-- auto-tested -->
- [x] **R.8** Activity feeds: task create/update and time-log events still appear <!-- auto-tested -->

## Summary

| Section | Core | Edge | Total |
|---------|------|------|-------|
| §01 Stay open | 12 | 5 | 17 |
| §02 Time logs | 14 | 7 | 21 |
| §03 Scope removal | 8 | 2 | 10 |
| §04 Total hover | 7 | 4 | 11 |
| §05 User filters | 9 | 3 | 12 |
| Permissions | 3 | — | 3 |
| Regressions | 8 | — | 8 |
| **Total** | **61** | **21** | **82** |
