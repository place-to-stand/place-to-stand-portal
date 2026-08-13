# PRD 005 — Manual Test Plan

**Update after every coding session.** Check off as sections land; record failures with the section
number and the observed behavior.

---

## Prerequisites

### Environment
- [ ] Internal portal running on **:3000** (`npm run dev` from `apps/internal`, or `npm run dev`
      from root for all apps)
- [ ] Client portal running on **:3001** — needed only for the §04 portal regression checks
- [ ] Signed in as an **ADMIN** user. The internal portal is admin-only: CLIENT-role users are
      rejected at sign-in and non-ADMIN sessions are redirected to `CLIENT_PORTAL_URL`
- [ ] Browsing via `https://pts.localhost` if that's your usual setup

### Database state
- [ ] All PRD 005 migrations applied (`npm run db:migrate`)
- [ ] At least **3 leads** in different statuses, at least one `CLOSED_WON` and not yet converted
- [ ] At least one lead **with an assignee** and one **without** (for D16 coverage)
- [ ] At least **2 contacts** that can serve as origination referrers
- [ ] At least one **admin user** other than yourself (internal-partner origination)
- [ ] At least one **existing client** with origination and closer **already set** (§05 no-overwrite)
- [ ] At least one lead assigned to an **archived** admin user (`users.deleted_at IS NOT NULL`) —
      the only way to exercise the W12 conversion guard (tests 5.23a/b)
- [ ] Leads spread across staleness thresholds: one touched today, one touched ~5 days ago, one with
      **zero** updates created >30 days ago (tests 3.32–3.36)
- [ ] At least one **CLIENT project with tasks** visible in the portal (§04 regression baseline)

> Fixture caveat: SQL-seeded users have no `auth.users` record, which breaks auth-coupled flows.
> If a user-related action behaves oddly, check whether the user was seeded rather than created
> through the app.

### Pre-implementation
- [ ] All audits A1–A6 recorded in [PROGRESS.md](PROGRESS.md)
- [ ] A5 (unmatched `source_detail`) signed off before any §05 destructive test

---

## Section 01 — Sales project defect

### Core
- [ ] **1.1** Open a task sheet from a **non-canonical** route (e.g. `/my/home?task=new`) → sheet
      opens, no error
- [ ] **1.2** Check the network tab: `GET /api/sheets/init` returns **200**, not 500
- [ ] **1.3** Query `SELECT id, name, slug FROM projects WHERE type='INTERNAL'` → **no**
      `sales-strategy` project was created by opening the sheet
- [ ] **1.4** Create a task from the **lead sheet** → note its `project_id`
- [ ] **1.5** Create a task from the **task sheet** with `?lead=<id>` → same `project_id` as 1.4

### Regression — the actual bug
- [ ] **1.6** Soft-delete a `sales-strategy` project manually:
      `UPDATE projects SET deleted_at = now() WHERE slug='sales-strategy';`
      Then open a task sheet → **no unique-violation error**, sheet opens normally
- [ ] **1.7** Run `npx tsx scripts/dedupe-sales-project.ts` → completes; tasks re-pointed
- [ ] **1.8** Run it a second time → reports "No bogus … projects found"
- [ ] **1.9** After 1.7, open a task sheet again → still 200, still no project created

### Edge
- [ ] **1.10** Open two task sheets in rapid succession (two browser tabs) → neither errors *(concurrent
      resolution)*
- [ ] **1.11** With **no** `Sales` project at all in the database, create a lead task → project is
      created once, task lands in it

---

## Section 02 — Schema: lead updates

Schema-only; verified by inspection and migration behavior.

- [ ] **2.1** `\d lead_updates` shows all columns with correct types and `NOT NULL` where specified
- [ ] **2.2** `\dT+ lead_update_type` shows exactly `MEETING`, `PHONE_CALL`, `EMAIL`, `NOTE`
- [ ] **2.3** Both indexes exist; `idx_lead_updates_lead_occurred` is composite `(lead_id, occurred_at DESC)`
- [ ] **2.4** Hard-deleting a lead cascades its updates away
- [ ] **2.5** Deleting a `users` row referenced as `author_id` is **blocked** by `RESTRICT`
- [ ] **2.6** Inserting an invalid `type` value is rejected by the enum
- [ ] **2.7** `occurred_at` defaults to now() when omitted
- [ ] **2.8** Migration file contains no `DROP`, no `ENABLE ROW LEVEL SECURITY`, no `CREATE POLICY`
- [ ] **2.9** Re-running `npm run db:migrate` is a no-op

---

## Section 03 — Updates timeline UI

### Logging
- [ ] **3.1** Open a lead sheet → Updates section renders **below** Tasks in the right column
- [ ] **3.2** Log a **Meeting** with a body → appears immediately at the top, no page reload
- [ ] **3.3** Log a **Phone call**, **Email**, and **Note** → each shows a distinct icon **and** text
      label **and** color
- [ ] **3.4** Composer closes on successful save
- [ ] **3.5** Save button is **enabled** on an untouched composer (not gated on `isDirty`), and shows
      a pending state only while saving
- [ ] **3.6** Log an update with a **past** `occurredAt` → accepted, sorts into the correct position
- [ ] **3.7** Log an update with a **future** `occurredAt` → **rejected** with a validation message

### Last touch
- [ ] **3.8** Lead with no updates → "No touches logged"
- [ ] **3.9** Log a Meeting dated 12 days ago → "Last touched 12 days ago"
- [ ] **3.10** Hover the readout → absolute date in the tooltip, correct and not off by one
- [ ] **3.11** Log a **`NOTE`** → last-touch readout **does not change** *(C5)*
- [ ] **3.12** Log an Email dated today → readout updates to today
- [ ] **3.13** Soft-delete the most recent touch → readout falls back to the next-most-recent
- [ ] **3.14** Edit a touch's `occurredAt` → readout recalculates *(this is why it's derived, D4)*

### Editing and deleting
- [ ] **3.15** Edit an update's body → persists and re-renders
- [ ] **3.16** Delete an update → disappears from the timeline
- [ ] **3.17** Verify the delete was **soft**: `SELECT deleted_at FROM lead_updates WHERE id=…` is
      non-null and the row still exists
- [ ] **3.18** Soft-deleted updates never appear in the timeline

### States
- [ ] **3.19** Loading shows a skeleton, not a blank panel
- [ ] **3.20** Empty state includes the log-update trigger
- [ ] **3.21** **Error state:** block `/api/leads/*/updates` in devtools, reload → a retry affordance
      appears. *Not* a silent empty list
- [ ] **3.22** Body at exactly 5000 chars → accepted; 5001 → rejected
- [ ] **3.23** Whitespace-only body → rejected

### Edge / concurrency
- [ ] **3.24** Two updates with the identical `occurred_at` → both render, ordering stable across reloads
- [ ] **3.25** Double-click Save rapidly → exactly **one** update created
- [ ] **3.26** Open the same lead in two tabs, log in one, refresh the other → both consistent
- [ ] **3.27** Lead with 50+ updates → timeline scrolls within the right column; the page body does
      **not** scroll horizontally

### Staleness (D19)
- [ ] **3.32** Lead in `NEW_OPPORTUNITIES` with a touch 2 days ago → **no** dot; at 4 days → dot
      appears (threshold 3)
- [ ] **3.33** Lead in `ON_ICE` with a touch 10 days ago → **no** dot (threshold 30)
- [ ] **3.34** `CLOSED_WON` / `CLOSED_LOST` / `UNQUALIFIED` leads → **never** show a dot regardless
      of last touch
- [ ] **3.35** Lead with **zero** updates, created 30 days ago → **is** stale (measured from
      `createdAt` — otherwise the feature does nothing on existing data)
- [ ] **3.36** Logging a touch on a stale lead → dot disappears without a page reload
- [ ] **3.37** Logging a **`NOTE`** on a stale lead → dot **remains** (NOTE is not a touch)
- [ ] **3.38** Dot has an `aria-label`; hovering shows day count + absolute date. Screen reader
      conveys the same signal as the color
- [ ] **3.39** Dot does **not** displace, resize, or restyle D17's origination badge; card height
      unchanged
- [ ] **3.40** "Needs follow-up" toggle is **off** by default
- [ ] **3.41** Toggling it filters every column to stale leads; toggling off restores all
- [ ] **3.42** With the filter on, drag-and-drop between columns still works and does not resurrect
      filtered-out cards
- [ ] **3.43** Filter active + zero stale leads → sensible empty state, not seven blank columns
- [ ] **3.44** No `is_stale` column exists: `\d leads` shows none
- [ ] **3.44a** Change a threshold on `/leads/settings` → the dots on the board update accordingly
      *(thresholds are configured, not hardcoded — D22)*
- [ ] **3.44b** Delete a `lead_stage_settings` row directly in SQL → that stage falls back to
      `LEAD_STALE_AFTER_DAYS`, **not** to "never stale" *(C14)*

### Board filter row (D23)
- [ ] **3.44c** Filter row renders above the board with the follow-up toggle **and** an assignee
      select — the board had no toolbar before this
- [ ] **3.44d** Assignee filter narrows to that person's leads; combines with the follow-up toggle
      (my overdue leads)
- [ ] **3.44e** Reset button clears both and is disabled when no filter is active
- [ ] **3.44f** Filter state appears in the URL; refreshing the page preserves it
- [ ] **3.44g** Opening a lead sheet with a filter active preserves both params; closing the sheet
      keeps the filter
- [ ] **3.44h** No status filter and no search box are present

### Follow-up shortcut (D21)
- [ ] **3.45** "Add follow-up task" is **unchecked** by default
- [ ] **3.46** Checked + successful save → task quick-capture opens prefilled with this lead
- [ ] **3.47** Checked + **failed** save (e.g. future `occurredAt`) → task capture does **not** open
- [ ] **3.48** Unchecked + save → no task capture
- [ ] **3.49** `\d tasks` shows **no** `lead_update_id` column
- [ ] **3.49a** Captured task's due date defaults to today + the lead's stage threshold (3 days for
      a new opportunity, 7 for active) *(D24)*
- [ ] **3.49b** That default is editable before saving
- [ ] **3.49c** A lead in a stage with no threshold → no default due date, no error

### Revalidation (W13)
- [ ] **3.50** Log an update, then open `/leads/activity` → the `LEAD_UPDATE_LOGGED` entry is present
      without a hard refresh

### Permissions
- [ ] **3.28** `POST` to the update action while signed out → rejected
- [ ] **3.29** Attempt to edit an update by passing a **different** lead's id → rejected
- [ ] **3.30** Activity feed shows a `LEAD_UPDATE_LOGGED` entry after logging
- [ ] **3.31** Editing or deleting an update produces **no** additional feed entry

---

## Section 04 — Lead task placement

### Creation
- [ ] **4.1** Create a task from a lead sheet → succeeds
- [ ] **4.2** `SELECT project_id, lead_id FROM tasks WHERE id=…` → `project_id` **NULL**, `lead_id` set
- [ ] **4.3** Task appears in that lead's Tasks section
- [ ] **4.4** Create a second lead task → ranks are distinct and ordering is stable
- [ ] **4.5** Create tasks on **two different leads** → each appears only under its own lead

### Placement
- [ ] **4.6** Open every project board → the lead task appears on **none** of them
- [ ] **4.7** Assign the lead task to yourself → it **appears** in My Tasks
- [ ] **4.8** Reorder in My Tasks alongside project tasks → works, persists
- [ ] **4.9** Mark it DONE → moves correctly and `completed_at` is stamped
- [ ] **4.10** Archive it → **stays visible in the lead sheet's Tasks section under an archived
      grouping** (D18), collapsed by default
- [ ] **4.10a** That archived lead task appears in **no** project archive view
- [ ] **4.10b** Restore it from the lead sheet → returns to the active grouping *(PW6 — the restore
      control must exist, not just the grouping)*
- [ ] **4.10c** Archived grouping is collapsed by default and does not push active tasks below the
      fold

### Task sheet
- [ ] **4.11** Open a lead task's sheet → "Lead task" indicator instead of a project selector
- [ ] **4.12** Time-logging UI is **hidden** (not merely disabled)
- [ ] **4.13** Assignees, due date, description, comments, attachments all work
- [ ] **4.14** Open a **project** task's sheet → project selector and time logging unchanged

### Guards
- [ ] **4.15** `POST` a time log against a lead task's id directly → rejected with a clear error
- [ ] **4.16** Insert a task with both `project_id` and `lead_id` NULL → rejected by
      `tasks_anchor_present`
- [ ] **4.17** Insert with both set → **allowed** (deliberately not mutually exclusive)

### Portal regression — must NOT change
- [ ] **4.18** Sign into the client portal (:3001) as a portal user with an existing CLIENT project
- [ ] **4.19** Project page shows **exactly** the tasks it showed before this section
- [ ] **4.20** No lead task appears anywhere in the portal
- [ ] **4.21** Dashboard per-project open-task counts are unchanged
- [ ] **4.22** Confirm `apps/client/lib/data/tasks.ts` is untouched in the diff

### Regression — internal
- [ ] **4.23** Project boards render, drag-and-drop reorder works, ranks persist
- [ ] **4.24** Log time against a **project** task → works as before
- [ ] **4.25** Monthly-close time aggregation unchanged
- [ ] **4.26** Project archive and activity tabs render without error

---

## Section 05 — Lead origination model

### UI
- [ ] **5.1** Lead sheet shows an origination picker; the old Source / Source Info fields are gone
- [ ] **5.2** Select **internal partner** → admin user list appears; pick one; saves
- [ ] **5.3** Select **external contact** → contact list appears; pick one; saves
- [ ] **5.4** Switch internal → external → the internal value is **cleared**, not retained
- [ ] **5.5** Clear origination entirely → both fields null
- [ ] **5.6** Reopen the sheet → the saved selection renders correctly
- [ ] **5.7** The **client** sheet's origination picker still works identically *(shared component,
      C9)*
- [ ] **5.8** Contact search filters as you type

### Lead card badge (D17)
- [ ] **5.8a** Lead with an **external contact** origination → card badge reads `Referral`
- [ ] **5.8b** Hover that badge → the contact's **name** appears in the tooltip
- [ ] **5.8c** Lead with an **internal partner** origination → card badge reads `Partner`, name on
      hover
- [ ] **5.8d** Lead with **no** origination → **no badge rendered** (matches today's null handling)
- [ ] **5.8e** Badge styling matches the old source badge exactly — same slot, uppercase, muted,
      `text-[10px]`
- [ ] **5.8f** Card does **not** show last-touch anywhere *(D17 — deliberately omitted)*
- [ ] **5.8g** Board card height/density is unchanged versus before the swap

### Constraint
- [ ] **5.9** Attempt to set both fields via direct SQL → rejected by `leads_origination_mutex`
- [ ] **5.10** Set one via the UI → the action clears the other; **no** raw constraint error ever
      reaches the user
- [ ] **5.11** Setting an external contact creates a `contact_leads` row
- [ ] **5.12** Changing the contact updates that row; clearing removes it
- [ ] **5.13** Setting the **same** contact twice does not violate
      `contact_leads_contact_lead_key`

### Backfill
- [ ] **5.14** A pre-migration lead whose `source_detail` matched a contact name now shows that
      contact as external origination
- [ ] **5.15** A pre-migration `REFERRAL` lead with **no** contact match now shows no origination
      *(expected — D15)*
- [ ] **5.16** Former `WEBSITE` and `EVENT` leads show no origination and render without error
- [ ] **5.17** `SELECT count(*) FROM contact_leads` matches the backfilled origination count

### Conversion
- [ ] **5.18** Convert a `CLOSED_WON` lead with an **external referrer** to a **new** client →
      `clients.origination_contact_id` is set
- [ ] **5.19** Convert one with an **internal partner** → `clients.origination_user_id` is set
- [ ] **5.20** In both cases `clients.closer_user_id` equals the lead's `assignee_id` *(D16)*
- [ ] **5.21** Convert an **unassigned** lead → `closer_user_id` null, no error
- [ ] **5.22** Convert onto an **existing client that already has** origination and closer set →
      existing values **unchanged**, and a warning appears in the conversion result *(C10)*
- [ ] **5.23** Convert onto an existing client with **null** origination → value is filled in
- [ ] **5.23a** **Convert a lead whose assignee has since been archived** → conversion **succeeds**,
      `closer_user_id` is null, and a warning appears. It must **not** fail with "Selected partner
      user is archived" *(W12 — needs the archived-admin fixture)*
- [ ] **5.23b** Same for a lead whose internal-partner origination user was archived
- [ ] **5.24** Monthly-close **origination** section renders the newly converted client correctly
- [ ] **5.25** Monthly-close **partner payouts** section renders correctly

### Route removal
- [ ] **5.26** `POST /api/integrations/leads-intake` with a previously valid token → **404**
- [ ] **5.27** `grep -rn "leads-intake" apps packages turbo.json CLAUDE.md` → no hits outside
      `docs/` history and this PRD
- [ ] **5.28** `grep -rn "LEADS_INTAKE_TOKEN" .` (excluding `node_modules`, `.next`) → no hits
- [ ] **5.29** CLAUDE.md no longer contains a "Lead Intake Webhook" section
- [ ] **5.30** `npm run build` from root succeeds with `LEADS_INTAKE_TOKEN` **absent** from the
      environment

### Regression
- [ ] **5.31** Leads board renders all seven columns; drag between columns works
- [ ] **5.32** Lead archive and activity tabs render
- [ ] **5.33** Existing `activity_logs` entries containing old `sourceType` metadata still render
      without error *(W10)*
- [ ] **5.34** Contacts pages render; a contact used as origination can still be opened and edited
- [ ] **5.35** Command palette lead search works
- [ ] **5.36** **Submissions are untouched** — the submission detail sheet still shows its own
      `sourceDetail` field, and the audit/contact intake endpoints still accept payloads. This is a
      *different* concept from lead source and must not have been swept up in the removal.
- [ ] **5.37** `npx tsx scripts/test-form-intake.ts` still runs against `audit-responses` /
      `contact-submissions`

---

## Section 06 — Lead settings

### Schema + seed
- [ ] **6.1** `\d lead_stage_settings` shows `status` unique, nullable `stale_after_days`,
      timestamps, and **no** `deleted_at`
- [ ] **6.2** After migration, exactly four seeded rows: 3 / 7 / 7 / 30
- [ ] **6.3** Terminal statuses have **no** row
- [ ] **6.4** Change a value, re-run `npm run db:migrate` → the tuned value **survives**
      (`ON CONFLICT DO NOTHING`)
- [ ] **6.5** Migration contains no `DROP`, no RLS statements

### Page
- [ ] **6.6** `Settings` tab appears on `/leads` between Leads and Archive
- [ ] **6.7** `/leads/settings` renders with the Settings tab active
- [ ] **6.8** One input per non-terminal stage, each labelled with its status badge
- [ ] **6.9** Terminal stages listed read-only as "Never"
- [ ] **6.10** Helper copy states that notes don't count toward follow-up
- [ ] **6.11** Save button is **enabled** on an untouched form (not gated on `isDirty`)

### Validation
- [ ] **6.12** Entering `0` → rejected with a message (would mark every lead stale instantly)
- [ ] **6.13** Negative value → rejected
- [ ] **6.14** Value > 365 → rejected
- [ ] **6.15** Empty input → saves as "never stale" for that stage, no error
- [ ] **6.16** Saving persists across a reload

### Permissions + revalidation
- [ ] **6.17** Unauthenticated request to `/leads/settings` → redirected to sign-in
- [ ] **6.18** Direct POST to the action while signed out → rejected
- [ ] **6.19** Saving a threshold then navigating to `/leads` shows updated dots **without** a hard
      refresh *(W17)*

---

## Cross-cutting

### Accessibility
- [ ] **X1** Every update type is distinguishable **without** color — icon and text label present
- [ ] **X2** Full keyboard traversal of the Updates composer: tab order, Enter to submit, Escape to
      cancel
- [ ] **X3** Origination picker is keyboard-operable and announces its selection
- [ ] **X4** Base UI select/menu items have paired `hover:` classes — `data-highlighted` does not
      fire on plain mouse hover in this codebase
- [ ] **X5** Timeline entries are reachable by screen reader in chronological order

### Responsive / theming
- [ ] **X6** Lead sheet at mobile width → right column stacks; no horizontal page scroll
- [ ] **X7** Dark mode → every update type token is legible; contrast holds
- [ ] **X8** Long update bodies and long contact names wrap; they do not overflow the panel

### Data integrity
- [ ] **X9** No migration in this PRD contains `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, or
      `pgPolicy()`
- [ ] **X10** Every new FK has an explicit `ON DELETE` behavior
- [ ] **X11** Soft deletes used everywhere for **entity** tables; no hard deletes introduced.
      **Carve-out (W14):** `contact_leads` is a pure link table with no `deletedAt` — clearing a
      referrer hard-deletes the row, matching `contact_clients`. That is correct and expected.
- [ ] **X12** All date rendering uses `formatCalendarDate` — no ambient-timezone `format()`

### Permissions
- [ ] **X13** All new API routes and actions reject unauthenticated requests
- [ ] **X14** All new API routes and actions call `assertAdmin` / `requireRole('ADMIN')`
- [ ] **X15** A CLIENT-role user attempting to reach the internal portal is redirected to the client
      portal, not shown a partial page

### Build
- [ ] **X16** `npm run build` passes from repo root
- [ ] **X17** `npm run lint` passes from repo root
- [ ] **X18** `npm run type-check` passes from repo root

---

## Summary

| Section | Tests | Notes |
| --- | --- | --- |
| 01 — Sales project defect | 11 | Includes the 1.6 crash regression |
| 02 — Schema: lead updates | 9 | Inspection + migration behavior |
| 03 — Updates timeline UI | 61 | Largest surface; D19 staleness, D23 filter row, D21/D24 shortcut, W13 |
| 04 — Lead task placement | 29 | 5 client-portal regression checks + D18 archive & restore |
| 05 — Lead origination model | 46 | Backfill, conversion, D17 badge, W12 guard, submissions |
| 06 — Lead settings | 19 | Schema, seed idempotency, validation, revalidation |
| Cross-cutting | 18 | A11y, responsive, integrity, permissions, build |
| **Total** | **193** | |

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
| **3.44b / 6.4** | A missing settings row silently disabling staleness looks identical to a quiet board (C14); a re-run migration stomping tuned values undoes the point of D22 |
