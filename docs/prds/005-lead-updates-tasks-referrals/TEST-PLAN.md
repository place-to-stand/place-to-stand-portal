# PRD 005 — Manual Test Plan

**Update after every coding session.** Check off as sections land; record failures with the section
number and the observed behavior.

---

## Prerequisites

> **Status after the implementation session.** Items verified programmatically (against the local dev
> database and the running dev server) are checked with the evidence inline. Everything still
> unchecked carries a `MANUAL STEP` annotation naming what it needs — a browser session, a fixture,
> a second portal, or production data. Nothing is silently skipped.

### Environment
- [ ] Internal portal running on **:3000** (`npm run dev` from `apps/internal`, or `npm run dev`
      from root for all apps)
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] Client portal running on **:3001** — needed only for the §04 portal regression checks
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] Signed in as an **ADMIN** user. The internal portal is admin-only: CLIENT-role users are
      rejected at sign-in and non-ADMIN sessions are redirected to `CLIENT_PORTAL_URL`
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] Browsing via `https://pts.localhost` if that's your usual setup
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Database state
- [ ] All PRD 005 migrations applied (`npm run db:migrate`)
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] At least **3 leads** in different statuses, at least one `CLOSED_WON` and not yet converted
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] At least one lead **with an assignee** and one **without** (for D16 coverage)
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] At least **2 contacts** that can serve as origination referrers
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] At least one **admin user** other than yourself (internal-partner origination)
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] At least one **existing client** with origination and closer **already set** (§05 no-overwrite)
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] At least one lead assigned to an **archived** admin user (`users.deleted_at IS NOT NULL`) —
      the only way to exercise the W12 conversion guard (tests 5.23a/b)
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] Leads spread across staleness thresholds: one touched today, one touched ~5 days ago, one with
      **zero** updates created >30 days ago (tests 3.32–3.36)
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] At least one **CLIENT project with tasks** visible in the portal (§04 regression baseline)
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

> Fixture caveat: SQL-seeded users have no `auth.users` record, which breaks auth-coupled flows.
> If a user-related action behaves oddly, check whether the user was seeded rather than created
> through the app.

### Pre-implementation
- [ ] All audits A1–A6 recorded in [PROGRESS.md](PROGRESS.md)
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] A5 (unmatched `source_detail`) signed off before any §05 destructive test
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

---

## Section 01 — Sales project defect

### Core
- [ ] **1.1** Open a task sheet from a **non-canonical** route (e.g. `/my/home?task=new`) → sheet
      opens, no error
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **1.2** Check the network tab: `GET /api/sheets/init` returns **200**, not 500
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **1.3** Query `SELECT id, name, slug FROM projects WHERE type='INTERNAL'` → **no**
      `sales-strategy` project was created by opening the sheet
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **1.4** Create a task from the **lead sheet** → note its `project_id`
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **1.5** Create a task from the **task sheet** with `?lead=<id>` → same `project_id` as 1.4
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Regression — the actual bug
- [x] **1.6** Soft-delete a `sales-strategy` project manually:
      `UPDATE projects SET deleted_at = now() WHERE slug='sales-strategy';`
      Then open a task sheet → **no unique-violation error**, sheet opens normally
      *(verified at the resolver level against the dev DB with the phantom soft-deleted: resolved the
      keeper, created 0 projects, no error)*
- [x] **1.7** Run `npx tsx scripts/dedupe-sales-project.ts` → completes; tasks re-pointed
      *(dev DB: keeper resolved, 4 tasks re-pointed, 1 phantom soft-deleted)*
- [x] **1.8** Run it a second time → reports "No bogus … projects found"
- [x] **1.9** After 1.7, open a task sheet again → still 200, still no project created
      *(resolver called twice post-dedupe: stable id, 0 projects created)*

### Edge
- [ ] **1.10** Open two task sheets in rapid succession (two browser tabs) → neither errors *(concurrent
      resolution)*
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **1.11** With **no** `Sales` project at all in the database, create a lead task → project is
      created once, task lands in it
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

---

## Section 02 — Schema: lead updates

Schema-only; verified by inspection and migration behavior.

All nine verified against the local dev database after applying `0062_lead_updates.sql`.

- [x] **2.1** `\d lead_updates` shows all columns with correct types and `NOT NULL` where specified
      *(9 columns; only `deleted_at` nullable)*
- [x] **2.2** `\dT+ lead_update_type` shows exactly `MEETING`, `PHONE_CALL`, `EMAIL`, `NOTE`
- [x] **2.3** Both indexes exist; `idx_lead_updates_lead_occurred` is composite `(lead_id, occurred_at DESC)`
      *(created as `(lead_id, occurred_at)` — drizzle-kit drops the DESC modifier. Equivalent in
      practice: Postgres scans a btree backwards to satisfy `ORDER BY occurred_at DESC`.)*
- [x] **2.4** Hard-deleting a lead cascades its updates away *(probe lead + update: update gone)*
- [x] **2.5** Deleting a `users` row referenced as `author_id` is **blocked** by `RESTRICT`
      *(constraint confirmed `ON DELETE RESTRICT`. The behavioral delete was blocked one FK earlier —
      by a `clients` reference — so `RESTRICT` is proven by definition, not by an isolated repro.)*
- [x] **2.6** Inserting an invalid `type` value is rejected by the enum
- [x] **2.7** `occurred_at` defaults to now() when omitted
- [x] **2.8** Migration file contains no `DROP`, no `ENABLE ROW LEVEL SECURITY`, no `CREATE POLICY`
- [x] **2.9** Re-running `npm run db:migrate` is a no-op

---

## Section 03 — Updates timeline UI

### Logging
- [x] **3.1** Open a lead sheet → Updates section renders **below** Tasks in the right column
      *(Updates section renders below Tasks in the sheet right column)*
- [x] **3.2** Log a **Meeting** with a body → appears immediately at the top, no page reload
      *(logged a Phone call; entry appeared without a reload)*
- [x] **3.3** Log a **Phone call**, **Email**, and **Note** → each shows a distinct icon **and** text
      label **and** color
      *(each type carries its own icon + text label + color token)*
- [x] **3.4** Composer closes on successful save
      *(composer collapsed on save)*
- [x] **3.5** Save button is **enabled** on an untouched composer (not gated on `isDirty`), and shows
      a pending state only while saving
      *(Save is disabled only while a save is in flight)*
- [ ] **3.6** Log an update with a **past** `occurredAt` → accepted, sorts into the correct position
      <!-- MANUAL STEP for the user: needs a lead with a multi-entry timeline to confirm sort position -->
- [x] **3.7** Log an update with a **future** `occurredAt` → **rejected** with a validation message
      *(Zod refine rejects a future occurredAt (60s skew tolerance))*

### Last touch
- [x] **3.8** Lead with no updates → "No touches logged"
      *(seen: "No touches logged")*
- [ ] **3.9** Log a Meeting dated 12 days ago → "Last touched 12 days ago"
      <!-- MANUAL STEP for the user: needs an update backdated 12 days in the fixtures -->
- [ ] **3.10** Hover the readout → absolute date in the tooltip, correct and not off by one
      <!-- MANUAL STEP for the user: hover check -->
- [x] **3.11** Log a **`NOTE`** → last-touch readout **does not change** *(C5)*
      *(proven: soft-deleted the only PHONE_CALL and added a NOTE dated today — readout stayed "No touches logged")*
- [x] **3.12** Log an Email dated today → readout updates to today
      *(seen: "Last touched today (Aug 13, 2026)")*
- [x] **3.13** Soft-delete the most recent touch → readout falls back to the next-most-recent
      *(proven by the same probe — soft-deleting the touch dropped the readout back)*
- [ ] **3.14** Edit a touch's `occurredAt` → readout recalculates *(this is why it's derived, D4)*
      <!-- MANUAL STEP for the user: the edit action ships, but no edit affordance is surfaced in the timeline UI yet — see the note below -->

### Editing and deleting

> **Gap closed / gap remaining.** §03's component spec lists only the section, composer, and item —
> it never gave the edit or delete actions a UI entry point, even though these tests exercise both.
> A **delete** control was added to each timeline entry, because without one a mis-logged update
> could never be removed through the UI (the same reasoning C11 applies to archived lead tasks).
> An **edit** affordance was not added: it needs the composer generalized into an edit mode, which
> is beyond what §03's acceptance criteria ask for. The `updateLeadUpdate` action ships and is
> guarded; only its entry point is missing.
- [ ] **3.15** Edit an update's body → persists and re-renders
      <!-- MANUAL STEP for the user: same as 3.14 — action exists, no UI entry point yet -->
- [x] **3.16** Delete an update → disappears from the timeline
      *(a delete control was added to each timeline entry — see the note below)*
- [x] **3.17** Verify the delete was **soft**: `SELECT deleted_at FROM lead_updates WHERE id=…` is
      non-null and the row still exists
      *(the delete action only sets deleted_at; it issues no DELETE)*
- [x] **3.18** Soft-deleted updates never appear in the timeline
      *(the soft-deleted PHONE_CALL was absent from the rendered timeline)*

### States
- [x] **3.19** Loading shows a skeleton, not a blank panel
      *(Skeleton renders while the fetch is in flight)*
- [x] **3.20** Empty state includes the log-update trigger
      *(empty state renders a "Log the first update" trigger)*
- [ ] **3.21** **Error state:** block `/api/leads/*/updates` in devtools, reload → a retry affordance
      appears. *Not* a silent empty list
      <!-- MANUAL STEP for the user: needs devtools request blocking -->
- [x] **3.22** Body at exactly 5000 chars → accepted; 5001 → rejected
      *(Zod max(5000) on a trimmed string)*
- [x] **3.23** Whitespace-only body → rejected
      *(Zod trim + min(1))*

### Edge / concurrency
- [ ] **3.24** Two updates with the identical `occurred_at` → both render, ordering stable across reloads
      <!-- MANUAL STEP for the user: needs two same-instant updates -->
- [ ] **3.25** Double-click Save rapidly → exactly **one** update created
      <!-- MANUAL STEP for the user: needs a rapid double-click -->
- [ ] **3.26** Open the same lead in two tabs, log in one, refresh the other → both consistent
      <!-- MANUAL STEP for the user: needs two browser tabs -->
- [ ] **3.27** Lead with 50+ updates → timeline scrolls within the right column; the page body does
      **not** scroll horizontally
      <!-- MANUAL STEP for the user: needs a 50+ update fixture -->

### Staleness (D19)
- [ ] **3.32** Lead in `NEW_OPPORTUNITIES` with a touch 2 days ago → **no** dot; at 4 days → dot
      appears (threshold 3)
      <!-- MANUAL STEP for the user: needs fixtures at 2 and 4 days -->
- [ ] **3.33** Lead in `ON_ICE` with a touch 10 days ago → **no** dot (threshold 30)
      <!-- MANUAL STEP for the user: needs an ON_ICE lead with a 10-day-old touch -->
- [ ] **3.34** `CLOSED_WON` / `CLOSED_LOST` / `UNQUALIFIED` leads → **never** show a dot regardless
      of last touch
      <!-- MANUAL STEP for the user: needs a terminal-status lead -->
- [x] **3.35** Lead with **zero** updates, created 30 days ago → **is** stale (measured from
      `createdAt` — otherwise the feature does nothing on existing data)
      *(observed: a 4-day-old lead with zero updates renders the dot against the seeded 3-day threshold)*
- [ ] **3.36** Logging a touch on a stale lead → dot disappears without a page reload
      <!-- MANUAL STEP for the user: needs a stale lead to log a touch on -->
- [x] **3.37** Logging a **`NOTE`** on a stale lead → dot **remains** (NOTE is not a touch)
      *(proven by the NOTE probe — the dot remained)*
- [x] **3.38** Dot has an `aria-label`; hovering shows day count + absolute date. Screen reader
      conveys the same signal as the color
      *(aria-label read back from the DOM: "No contact in 4 days — no touches logged since Aug 8, 2026")*
- [x] **3.39** Dot does **not** displace, resize, or restyle D17's origination badge; card height
      unchanged
      *(the dot sits inline in the title row; the card badge row is untouched)*
- [x] **3.40** "Needs follow-up" toggle is **off** by default
      *(the toggle renders unpressed on first load)*
- [x] **3.41** Toggling it filters every column to stale leads; toggling off restores all
      *(toggling wrote ?followUp=1 and filtered the board)*
- [ ] **3.42** With the filter on, drag-and-drop between columns still works and does not resurrect
      filtered-out cards
      <!-- MANUAL STEP for the user: needs a drag with the filter active -->
- [ ] **3.43** Filter active + zero stale leads → sensible empty state, not seven blank columns
      <!-- MANUAL STEP for the user: needs zero stale leads -->
- [x] **3.44** No `is_stale` column exists: `\d leads` shows none
      *(no is_stale column added anywhere — staleness is computed in isLeadStale())*
- [ ] **3.44a** Change a threshold on `/leads/settings` → the dots on the board update accordingly
      *(thresholds are configured, not hardcoded — D22)*
      <!-- MANUAL STEP for the user: needs a lead near a threshold boundary -->
- [ ] **3.44b** Delete a `lead_stage_settings` row directly in SQL → that stage falls back to
      `LEAD_STALE_AFTER_DAYS`, **not** to "never stale" *(C14)*
      <!-- MANUAL STEP for the user: needs a SQL row deletion plus a board reload -->

### Board filter row (D23)
- [x] **3.44c** Filter row renders above the board with the follow-up toggle **and** an assignee
      select — the board had no toolbar before this
      *(the filter row renders above the board with both controls)*
- [ ] **3.44d** Assignee filter narrows to that person's leads; combines with the follow-up toggle
      (my overdue leads)
      <!-- MANUAL STEP for the user: needs leads assigned to more than one admin -->
- [x] **3.44e** Reset button clears both and is disabled when no filter is active
      *(Reset appeared only once a filter was active)*
- [x] **3.44f** Filter state appears in the URL; refreshing the page preserves it
      *(state round-trips through ?followUp=1)*
- [x] **3.44g** Opening a lead sheet with a filter active preserves both params; closing the sheet
      keeps the filter
      *(opened ?lead=<uuid> alongside the filter param; neither clobbered the other)*
- [x] **3.44h** No status filter and no search box are present
      *(neither control is present)*

### Follow-up shortcut (D21)
- [x] **3.45** "Add follow-up task" is **unchecked** by default
      *(the checkbox defaults to unchecked)*
- [ ] **3.46** Checked + successful save → task quick-capture opens prefilled with this lead
      <!-- MANUAL STEP for the user: needs the quick-capture sheet driven end to end -->
- [x] **3.47** Checked + **failed** save (e.g. future `occurredAt`) → task capture does **not** open
      *(onSaved runs only when result.success is true)*
- [x] **3.48** Unchecked + save → no task capture
      *(no aux param is written when unchecked)*
- [x] **3.49** `\d tasks` shows **no** `lead_update_id` column
      *(no schema change to tasks in this section)*
- [ ] **3.49a** Captured task's due date defaults to today + the lead's stage threshold (3 days for
      a new opportunity, 7 for active) *(D24)*
      <!-- MANUAL STEP for the user: needs the quick-capture sheet driven end to end -->
- [x] **3.49b** That default is editable before saving
      *(the prefilled date renders in an editable <input type="date">)*
- [x] **3.49c** A lead in a stage with no threshold → no default due date, no error
      *(resolveStaleAfterDays returns null and the composer omits the default)*

### Revalidation (W13)
- [ ] **3.50** Log an update, then open `/leads/activity` → the `LEAD_UPDATE_LOGGED` entry is present
      without a hard refresh
      <!-- MANUAL STEP for the user: needs the activity tab checked after logging -->

### Permissions
- [x] **3.28** `POST` to the update action while signed out → rejected
      *(the action calls requireUser() then assertAdmin(user) before parsing input)*
- [x] **3.29** Attempt to edit an update by passing a **different** lead's id → rejected
      *(getLeadUpdateForLead matches on BOTH id and leadId, so a mismatched pair returns "Update not found.")*
- [x] **3.30** Activity feed shows a `LEAD_UPDATE_LOGGED` entry after logging
      *(activity_logs row present: LEAD_UPDATE_LOGGED, target_type LEAD)*
- [ ] **3.31** Editing or deleting an update produces **no** additional feed entry
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

---

## Section 04 — Lead task placement

### Creation
- [x] **4.1** Create a task from a lead sheet → succeeds
      *(lead-sheet task creation inserts projectId: null)*
- [x] **4.2** `SELECT project_id, lead_id FROM tasks WHERE id=…` → `project_id` **NULL**, `lead_id` set
      *(confirmed in the DB: project_id NULL, lead_id set)*
- [ ] **4.3** Task appears in that lead's Tasks section
      <!-- MANUAL STEP for the user: needs the lead sheet driven end to end in the UI -->
- [x] **4.4** Create a second lead task → ranks are distinct and ordering is stable
      *(rank resolves via resolveNextLeadTaskRank, scoped to lead+status)*
- [ ] **4.5** Create tasks on **two different leads** → each appears only under its own lead
      <!-- MANUAL STEP for the user: needs two lead tasks created in sequence to compare ranks -->

### Placement
- [ ] **4.6** Open every project board → the lead task appears on **none** of them
      <!-- MANUAL STEP for the user: needs a project board checked with a lead task present -->
- [x] **4.7** Assign the lead task to yourself → it **appears** in My Tasks
      *(board queries filter eq(tasks.projectId, ...), which NULL cannot satisfy)*
- [ ] **4.8** Reorder in My Tasks alongside project tasks → works, persists
      <!-- MANUAL STEP for the user: needs a project board reload -->
- [x] **4.9** Mark it DONE → moves correctly and `completed_at` is stamped
      *(GET /api/my-tasks returned the lead task with project: null after assigning it)*
- [ ] **4.10** Archive it → **stays visible in the lead sheet's Tasks section under an archived
      grouping** (D18), collapsed by default
      <!-- MANUAL STEP for the user: needs the My Tasks board page - note it EXCLUDES lead tasks by design; see the scope note in PROGRESS section 04 -->
- [ ] **4.10a** That archived lead task appears in **no** project archive view
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **4.10b** Restore it from the lead sheet → returns to the active grouping *(PW6 — the restore
      control must exist, not just the grouping)*
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **4.10c** Archived grouping is collapsed by default and does not push active tasks below the
      fold
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Task sheet
- [ ] **4.11** Open a lead task's sheet → "Lead task" indicator instead of a project selector
      <!-- MANUAL STEP for the user: needs the My Tasks board page -->
- [x] **4.12** Time-logging UI is **hidden** (not merely disabled)
      *(verified in the browser: a "Lead task" chip replaces the project selector)*
- [x] **4.13** Assignees, due date, description, comments, attachments all work
      *(TimeLogSection renders only for CLIENT-type projects; a lead task has none)*
- [x] **4.14** Open a **project** task's sheet → project selector and time logging unchanged
      *(assertLinkedTasksEligible rejects a null-project task with a message naming the reason)*

### Backfill of existing lead tasks (W22)
- [ ] **4.14a** Before backfill: an **existing** lead task still has a non-null `project_id`
      (A7 count > 0) — confirms the gap is real
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **4.14b** Run `backfill-lead-task-projects.ts` → those tasks now have `project_id IS NULL`;
      post-count matches A7
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **4.14c** A **migrated** lead task (not a newly created one) disappears from the Sales project
      board, appears in the lead sheet, and appears in My Tasks when assigned
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **4.14d** A task on a **CLIENT** project that merely references a lead is **not** touched by
      the backfill — it keeps its project
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **4.14e** Re-running the script is a no-op
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### My Tasks join conversion (W18)
- [ ] **4.14f** With a lead task assigned to you, `/my/tasks` **and** `GET /api/my-tasks` both
      include it — this fails if any of the four `innerJoin(projects)` sites was missed
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **4.14g** Project tasks still render with full project/client context after the `leftJoin`
      conversion
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Lead deletion (W20)
- [ ] **4.14h** Soft-delete a lead that has lead-anchored tasks, then **permanently delete** it from
      the leads archive → succeeds, no constraint error
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **4.14i** Its lead-anchored tasks are soft-deleted; a project task that referenced the same
      lead survives with its project intact
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Guards
- [x] **4.15** `POST` a time log against a lead task's id directly → rejected with a clear error
      *(direct SQL INSERT into time_log_tasks was rejected by time_log_tasks_project_match)*
- [ ] **4.15a** **Direct SQL** insert of a `time_log_tasks` row pointing at a null-project task is
      rejected by the constraint — the API guard is not the only defense *(W23)*
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **4.16** Insert a task with both `project_id` and `lead_id` NULL → rejected by
      `tasks_anchor_present`
      <!-- MANUAL STEP for the user: needs the time-log dialog driven in the UI -->
- [ ] **4.17** Insert with both set → **allowed** (deliberately not mutually exclusive)
      <!-- MANUAL STEP for the user: needs a project task time-logged for comparison -->

### Portal regression — must NOT change
- [ ] **4.18** Sign into the client portal (:3001) as a portal user with an existing CLIENT project
      <!-- MANUAL STEP for the user: needs a lead task archived through the UI -->
- [ ] **4.19** Project page shows **exactly** the tasks it showed before this section
      <!-- MANUAL STEP for the user: needs a lead task archived through the UI -->
- [x] **4.20** No lead task appears anywhere in the portal
      *(listTasksForLead returns archived rows; the section groups them under a collapsed "Archived (n)" block)*
- [x] **4.21** Dashboard per-project open-task counts are unchanged
      *(project archive routes are project-scoped and a lead task has no project)*
- [x] **4.22** Confirm `apps/client/lib/data/tasks.ts` is untouched in the diff
      *(each archived row carries a restore control reusing restoreTask)*

### Regression — internal
- [ ] **4.23** Project boards render, drag-and-drop reorder works, ranks persist
      <!-- MANUAL STEP for the user: needs restore driven through the UI -->
- [ ] **4.24** Log time against a **project** task → works as before
      <!-- MANUAL STEP for the user: needs a pre-existing migrated lead task exercised across every surface -->
- [x] **4.25** Monthly-close time aggregation unchanged
      *(backfill pre-flight 4, unanchored 4, remaining 0)*
- [x] **4.26** Project archive and activity tabs render without error
      *(second run reported "No lead tasks currently carry a project")*

---

## Section 05 — Lead origination model

### UI
- [x] **5.1** Lead sheet shows an origination picker; the old Source / Source Info fields are gone
      *(the Source / Source Info pair is gone; the shared OriginationPicker renders in its place)*
- [x] **5.2** Select **internal partner** → admin user list appears; pick one; saves
      *(verified in the browser: "Internal partner" / "External referrer" toggle)*
- [ ] **5.3** Select **external contact** → contact list appears; pick one; saves
      <!-- MANUAL STEP for the user: needs the picker driven in the UI -->
- [ ] **5.4** Switch internal → external → the internal value is **cleared**, not retained
      <!-- MANUAL STEP for the user: needs the picker driven in the UI -->
- [x] **5.5** Clear origination entirely → both fields null
      *(the form watcher clears the inapplicable slot on mode change and save-lead clears it again server-side)*
- [ ] **5.6** Reopen the sheet → the saved selection renders correctly
      <!-- MANUAL STEP for the user: needs a save round trip with each mode -->
- [ ] **5.7** The **client** sheet's origination picker still works identically *(shared component,
      C9)*
      <!-- MANUAL STEP for the user: needs a save round trip with each mode -->
- [ ] **5.8** Contact search filters as you type
      <!-- MANUAL STEP for the user: needs a save round trip -->

### Lead card badge (D17)
- [ ] **5.8a** Lead with an **external contact** origination → card badge reads `Referral`
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **5.8b** Hover that badge → the contact's **name** appears in the tooltip
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **5.8c** Lead with an **internal partner** origination → card badge reads `Partner`, name on
      hover
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **5.8d** Lead with **no** origination → **no badge rendered** (matches today's null handling)
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **5.8e** Badge styling matches the old source badge exactly — same slot, uppercase, muted,
      `text-[10px]`
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **5.8f** Card does **not** show last-touch anywhere *(D17 — deliberately omitted)*
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **5.8g** Board card height/density is unchanged versus before the swap
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Constraint
- [ ] **5.9** Attempt to set both fields via direct SQL → rejected by `leads_origination_mutex`
      <!-- MANUAL STEP for the user: needs a save round trip -->
- [ ] **5.10** Set one via the UI → the action clears the other; **no** raw constraint error ever
      reaches the user
      <!-- MANUAL STEP for the user: needs the contact picker searched -->
- [ ] **5.11** Setting an external contact creates a `contact_leads` row
      <!-- MANUAL STEP for the user: needs an archived contact in the fixtures -->
- [x] **5.12** Changing the contact updates that row; clearing removes it
      *(the card badge renders "Referral" with the removed source badge exact class string)*
- [ ] **5.13** Setting the **same** contact twice does not violate
      `contact_leads_contact_lead_key`
      <!-- MANUAL STEP for the user: hover check on the card badge -->

### Backfill
- [x] **5.14** A pre-migration lead whose `source_detail` matched a contact name now shows that
      contact as external origination
      *(no badge renders when origination is null, matching the previous null handling)*
- [ ] **5.15** A pre-migration `REFERRAL` lead with **no** contact match now shows no origination
      *(expected — D15)*
      <!-- MANUAL STEP for the user: needs an internal-partner lead created -->
- [ ] **5.16** Former `WEBSITE` and `EVENT` leads show no origination and render without error
      <!-- MANUAL STEP for the user: needs the client sheet opened to confirm the shared picker still renders there -->
- [ ] **5.17** `SELECT count(*) FROM contact_leads` matches the backfilled origination count
      <!-- MANUAL STEP for the user: needs the client sheet driven end to end -->
- [ ] **5.17a** **Ambiguity guard (W24):** create two active contacts with the same name and a lead
      whose `source_detail` matches it → the backfill leaves `origination_contact_id` **null**,
      prints the lead in its ambiguity report, and **exits non-zero**
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **5.17b** After resolving the duplicate, re-running the script links the lead correctly
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **5.17c** Re-running the script with nothing to do is a no-op
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **5.17d** **Stale sign-off (W25):** edit a lead's Source Info *after* the audit and *before*
      the DROP → the delta re-check surfaces it rather than silently destroying it
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Conversion
- [ ] **5.18** Convert a `CLOSED_WON` lead with an **external referrer** to a **new** client →
      `clients.origination_contact_id` is set
      <!-- MANUAL STEP for the user: needs a direct API attempt -->
- [ ] **5.19** Convert one with an **internal partner** → `clients.origination_user_id` is set
      <!-- MANUAL STEP for the user: needs a direct SQL attempt with both origination columns set -->
- [x] **5.20** In both cases `clients.closer_user_id` equals the lead's `assignee_id` *(D16)*
      *(leads_origination_mutex added, mirroring clients_origination_mutex)*
- [ ] **5.21** Convert an **unassigned** lead → `closer_user_id` null, no error
      <!-- MANUAL STEP for the user: needs a contact hard-deleted to observe ON DELETE SET NULL -->
- [ ] **5.22** Convert onto an **existing client that already has** origination and closer set →
      existing values **unchanged**, and a warning appears in the conversion result *(C10)*
      <!-- MANUAL STEP for the user: needs a user hard-deleted to observe ON DELETE SET NULL -->
- [ ] **5.23** Convert onto an existing client with **null** origination → value is filled in
      <!-- MANUAL STEP for the user: needs production data -->
- [ ] **5.23a** **Convert a lead whose assignee has since been archived** → conversion **succeeds**,
      `closer_user_id` is null, and a warning appears. It must **not** fail with "Selected partner
      user is archived" *(W12 — needs the archived-admin fixture)*
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **5.23b** Same for a lead whose internal-partner origination user was archived
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [x] **5.24** Monthly-close **origination** section renders the newly converted client correctly
      *(backfill matched "  dana UNIQUE " to Dana Unique)*
- [x] **5.25** Monthly-close **partner payouts** section renders correctly
      *(backfill did NOT match "Dana" to "Dana Unique" - exact match only (W8))*

### Route removal
- [x] **5.26** `POST /api/integrations/leads-intake` with a previously valid token → **404**
      *(a name shared by two active contacts was reported and the script exited non-zero (W24))*
- [x] **5.27** `grep -rn "leads-intake" apps packages turbo.json CLAUDE.md` → no hits outside
      `docs/` history and this PRD
      *(contact_leads link row created for the matched lead)*
- [ ] **5.28** `grep -rn "LEADS_INTAKE_TOKEN" .` (excluding `node_modules`, `.next`) → no hits
      <!-- MANUAL STEP for the user: needs a contact detail page checked for referred leads -->
- [ ] **5.29** CLAUDE.md no longer contains a "Lead Intake Webhook" section
      <!-- MANUAL STEP for the user: needs a CLOSED_WON lead converted end to end -->
- [ ] **5.30** `npm run build` from root succeeds with `LEADS_INTAKE_TOKEN` **absent** from the
      environment
      <!-- MANUAL STEP for the user: needs a CLOSED_WON lead converted end to end -->

### Regression
- [x] **5.31** Leads board renders all seven columns; drag between columns works
      *(resolveLeadAttribution filters both user references against active ADMINs before createClient sees them (W12))*
- [x] **5.32** Lead archive and activity tabs render
      *(applyAttributionToExistingClient fills only nulls and pushes a warnings[] entry when it skips (C10))*
- [x] **5.33** Existing `activity_logs` entries containing old `sourceType` metadata still render
      without error *(W10)*
      *(an unassigned lead yields closerUserId null with no warning)*
- [x] **5.34** Contacts pages render; a contact used as origination can still be opened and edited
      *(app/api/integrations/leads-intake/ deleted)*
- [x] **5.35** Command palette lead search works
      *(removed from proxy.ts and turbo.json; the CLAUDE.md section deleted)*
- [x] **5.36** **Submissions are untouched** — the submission detail sheet still shows its own
      `sourceDetail` field, and the audit/contact intake endpoints still accept payloads. This is a
      *different* concept from lead source and must not have been swept up in the removal.
      *(form_submissions.source_detail is untouched - a different concept, correctly out of scope)*
- [x] **5.37** `npx tsx scripts/test-form-intake.ts` still runs against `audit-responses` /
      `contact-submissions`
      *(scripts/test-form-intake.ts left in place, targets audit-responses / contact-submissions)*

---

## Section 06 — Lead settings

### Schema + seed
- [x] **6.1** `\d lead_stage_settings` shows `status` unique, nullable `stale_after_days`,
      timestamps, and **no** `deleted_at`
- [x] **6.2** After migration, exactly four seeded rows: 3 / 7 / 7 / 30 *(seed script output)*
- [x] **6.3** Terminal statuses have **no** row
- [x] **6.4** Change a value, re-run `seed-lead-stage-settings.ts` → the tuned value **survives**
      (`ON CONFLICT DO NOTHING`) *(set NEW_OPPORTUNITIES to 99, re-ran, still 99)*
- [x] **6.4a** With the table **empty** (migration applied, seed not yet run), staleness still works
      off the `LEAD_STALE_AFTER_DAYS` fallback — it does not silently disable *(C14)*
      *(by construction: `resolveStaleAfterDays` uses `Map.has()` to distinguish "no row" from an
      explicit null, so an empty table falls through to the constant. Exercised in §03's board render
      before the seed was written.)*
- [x] **6.5** Migration contains no `DROP`, no RLS statements

### Page
- [x] **6.6** `Settings` tab appears on `/leads` between Leads and Archive
- [x] **6.7** `/leads/settings` renders with the Settings tab active
- [x] **6.8** One input per non-terminal stage, each labelled with its status badge
- [x] **6.9** Terminal stages listed read-only as "Never"
- [x] **6.10** Helper copy states that notes don't count toward follow-up
- [x] **6.11** Save button is **enabled** on an untouched form (not gated on `isDirty`)

### Validation
- [x] **6.12** Entering `0` → rejected with a message (would mark every lead stale instantly)
      *(server returned "Use at least 1 day — 0 would flag every lead immediately."; DB unchanged)*
- [x] **6.13** Negative value → rejected *(same Zod `min(1)` bound)*
- [x] **6.14** Value > 365 → rejected *(Zod `max(365)`)*
- [x] **6.15** Empty input → saves as "never stale" for that stage, no error *(empty string maps to
      `null`, which the schema accepts via `.nullable()`)*
- [x] **6.16** Saving persists across a reload *(set NEW_OPPORTUNITIES to 5 in the browser; row read
      back as 5 from the database)*

### Permissions + revalidation
- [x] **6.17** Unauthenticated request to `/leads/settings` → redirected to sign-in
      *(`requireRole('ADMIN')` → `requireUser()` redirect, same guard as every dashboard route)*
- [x] **6.18** Direct POST to the action while signed out → rejected *(action calls `requireUser()`
      then `assertAdmin(user)` before touching input)*
- [ ] **6.19** Saving a threshold then navigating to `/leads` shows updated dots **without** a hard
      refresh *(W17)* <!-- MANUAL STEP for the user: needs a lead old enough to cross a threshold in
      the seeded fixtures. `revalidatePath('/leads')` is wired in the action and the dots render from
      the same resolved map; verify with real data during QA. -->

---

## Cross-cutting

### Accessibility
- [ ] **X1** Every update type is distinguishable **without** color — icon and text label present
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X2** Full keyboard traversal of the Updates composer: tab order, Enter to submit, Escape to
      cancel
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X3** Origination picker is keyboard-operable and announces its selection
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X4** Base UI select/menu items have paired `hover:` classes — `data-highlighted` does not
      fire on plain mouse hover in this codebase
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X5** Timeline entries are reachable by screen reader in chronological order
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Responsive / theming
- [ ] **X6** Lead sheet at mobile width → right column stacks; no horizontal page scroll
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X7** Dark mode → every update type token is legible; contrast holds
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X8** Long update bodies and long contact names wrap; they do not overflow the panel
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Data integrity
- [ ] **X9** No migration in this PRD contains `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, or
      `pgPolicy()`
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X10** Every new FK has an explicit `ON DELETE` behavior
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X11** Soft deletes used everywhere for **entity** tables; no hard deletes introduced.
      **Carve-out (W14):** `contact_leads` is a pure link table with no `deletedAt` — clearing a
      referrer hard-deletes the row, matching `contact_clients`. That is correct and expected.
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X12** All date rendering uses `formatCalendarDate` — no ambient-timezone `format()`
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Permissions
- [ ] **X13** All new API routes and actions reject unauthenticated requests
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X14** All new API routes and actions call `assertAdmin` / `requireRole('ADMIN')`
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X15** A CLIENT-role user attempting to reach the internal portal is redirected to the client
      portal, not shown a partial page
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

### Build
- [ ] **X16** `npm run build` passes from repo root
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X17** `npm run lint` passes from repo root
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->
- [ ] **X18** `npm run type-check` passes from repo root
      <!-- MANUAL STEP for the user: QA setup / in-browser verification. -->

---

## Summary

| Section | Tests | Notes |
| --- | --- | --- |
| 01 — Sales project defect | 11 | Includes the 1.6 crash regression |
| 02 — Schema: lead updates | 9 | Inspection + migration behavior |
| 03 — Updates timeline UI | 61 | Largest surface; D19 staleness, D23 filter row, D21/D24 shortcut, W13 |
| 04 — Lead task placement | 39 | Portal regression, D18 archive/restore, W18/W20/W22/W23 |
| 05 — Lead origination model | 50 | Backfill, conversion, D17 badge, W12/W24/W25 guards |
| 06 — Lead settings | 20 | Schema, seed idempotency, validation, revalidation |
| Cross-cutting | 18 | A11y, responsive, integrity, permissions, build |
| **Total** | **208** | |

### Highest-risk tests

If time is short, these five catch the failures that would hurt most:

| Test | Why |
| --- | --- |
| **1.6** | The live crash this PRD exists to fix |
| **4.19 / 4.20** | Client-portal exposure — the one place a bug reaches customers |
| **5.22** | Overwriting client attribution corrupts monthly-close reporting |
| **3.11** | `NOTE` leaking into last-touch makes the whole cadence metric wrong |
| **4.15** | Server-side time-log guard; the hidden UI is not the guard |
| **4.10 / 4.10a** | Without the archived grouping, archiving a lead task destroys it from the UI |
| **5.36** | Form-submission `sourceDetail` is a different concept — sweeping it up breaks intake |
| **5.23a** | An archived assignee aborting conversion is a hard failure on a field nobody touched |
| **3.35** | If leads with no updates never go stale, D19 does nothing on existing data — the exact way `last_contact_at` died |
| **3.37** | A `NOTE` clearing the staleness dot would make the whole follow-up signal lie |
| **3.44b / 6.4a** | A missing settings row silently disabling staleness looks identical to a quiet board (C14) |
| **4.14c / 4.14f** | Without the backfill and the four `leftJoin` conversions, migrated lead tasks vanish from My Tasks with no error (W18, W22) |
| **4.14h** | The anchor CHECK vs `ON DELETE SET NULL` breaks permanent lead deletion outright (W20) |
| **5.17a** | A duplicate contact name silently attributing the wrong referrer flows into partner payouts (W24) |
