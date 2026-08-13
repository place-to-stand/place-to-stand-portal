# PRD 005 — Progress

**Update this file after every coding session.** Record audit-query results here — several sections
depend on production data facts that must be captured before destructive steps run.

**Status:** Not started
**Last updated:** 2026-08-13 (PRD authored)

---

## Section status

| # | Section | Status | Branch | Notes |
| --- | --- | --- | --- | --- |
| 01 | [Sales project defect](01-sales-project-defect.md) | ⬜ Not started | — | **Ship first, own branch** |
| 02 | [Schema: lead updates](02-schema-lead-updates.md) | ⬜ Not started | — | |
| 03 | [Updates timeline UI](03-updates-timeline-ui.md) | ⬜ Not started | — | Needs **02 and 06** |
| 04 | [Lead task placement](04-lead-task-placement.md) | ⬜ Not started | — | Needs 01 |
| 05 | [Lead origination model](05-lead-origination-model.md) | ⬜ Not started | — | Longest pole — start early |
| 06 | [Lead settings](06-lead-settings.md) | ⬜ Not started | — | Blocks 03 (D19 thresholds) |
| 07 | [Future scope](07-future-scope.md) | n/a | — | Reference only |

Legend: ⬜ Not started · 🟡 In progress · 🔵 In review · ✅ Done

---

## Pre-implementation checklist

Do these **before** any section work.

- [ ] Working from a fresh worktree? Copy `.env.local` in and run a build first — worktrees resolve
      modules against the main repo's `node_modules` and need `next-env.d.ts` generated.
- [ ] `DATABASE_URL` set and `npm run db:migrate` run once to register existing migration state.
- [ ] Confirm the latest committed migration is still `0061_add_tasks_completed_at.sql`. If not,
      re-read the migration-numbering note in [README.md](README.md#schema-changes-summary).
- [ ] Read [README.md](README.md) Key Decisions in full. D9, D11, D12, and the "not on the card"
      half of D17 define what is **deliberately not built** — implementing them is scope creep, not
      helpfulness.
- [ ] Read [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md). C6, C7, and C10 are the three that
      cause real damage if ignored; **C12 and C13 block §05 from compiling at all.**
- [ ] Note the **file conflict**: §03 and §05 both modify `lead-card.tsx`. If working them in
      parallel, agree who lands first.
- [ ] Add at least one lead assigned to an **archived** admin user to the fixtures — it's the only
      way to exercise the W12 conversion guard.
- [ ] Confirm no RLS anywhere: no `ENABLE ROW LEVEL SECURITY`, no `CREATE POLICY`, no `pgPolicy()`.
      This project has none and must keep none.

### Required audits — record results here

These gate destructive work. **Do not proceed past a blank result cell.**

| Audit | Section | Query | Expected | Result | Date |
| --- | --- | --- | --- | --- | --- |
| A1 | 03 | `SELECT count(*) FILTER (WHERE last_contact_at IS NOT NULL), count(*) FILTER (WHERE awaiting_reply IS TRUE) FROM leads;` | `0`, `0` | | |
| A2 | 04 | `SELECT count(*) FROM tasks WHERE project_id IS NULL AND lead_id IS NULL;` | `0` | | |
| A3 | 04 | `SELECT prosrc FROM pg_proc WHERE proname = 'time_log_task_matches_project';` | function body | | |
| A4 | 05 | Source distribution (query 1) | — | | |
| A5 | 05 | REFERRAL detail → contact match (query 2) | — | | |
| A6 | 05 | WEBSITE/EVENT detail (query 3) | — | | |
| A7 | 04 | `SELECT p.name, count(*) FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.lead_id IS NOT NULL AND t.deleted_at IS NULL GROUP BY p.name;` — existing lead tasks to backfill (W22) | count > 0 expected | | |
| A8 | 05 | Ambiguity report: REFERRAL leads whose `source_detail` matches **more than one** active contact (W24) | `0` rows, or resolved | | |

**A3 — paste the function body here.** Section 04 C7: a `CHECK` constraint *passes* on `NULL`, so if
this function dereferences `tasks.project_id` without a null guard it may silently permit the
time-log linkage D10 forbids.

```sql
-- paste prosrc output here
```

**A5 — Jason's sign-off required.** Unmatched `source_detail` values are permanently discarded
(D15). List them here and record approval before generating 05's destructive migration.

- Unmatched count: ___
- Signed off by: ___ on ___

---

## Section 01 — Sales project defect

- [ ] `apps/internal/lib/leads/sales-project.ts` created with `import 'server-only'` and the
      conflict-safe `getOrCreateSalesProject`
- [ ] `create-lead-task.ts` imports it; local copy deleted
- [ ] `resolvers.ts` lines 228–271 deleted; imports the shared module
- [ ] `grep -rn "sales-strategy\|Sales Strategy" apps packages --include="*.ts" --include="*.tsx"`
      returns hits only in `scripts/dedupe-sales-project.ts`
- [ ] Task sheet init via `GET /api/sheets/init` returns 200 and creates no project
- [ ] Lead-sheet task creation and task-sheet `?lead=<id>` creation land in the **same** project
- [ ] **Regression:** with a soft-deleted `sales-strategy` project present, opening a task sheet does
      not throw a unique violation *(C2)*
- [ ] `npx tsx scripts/dedupe-sales-project.ts` run post-deploy; second run reports no bogus projects
- [ ] Build / lint / type-check pass from repo root

---

## Section 02 — Schema: lead updates

- [ ] `leadUpdateType` enum added — exactly `MEETING`, `PHONE_CALL`, `EMAIL`, `NOTE`
- [ ] `leadUpdates` table added with all columns
- [ ] `idx_lead_updates_lead_occurred` composite index present *(C3)*
- [ ] `idx_lead_updates_author` present
- [ ] FK `lead_id` → `leads` `ON DELETE CASCADE`
- [ ] FK `author_id` → `users` `ON DELETE RESTRICT` *(W2 — intentionally stricter than
      `task_comments`)*
- [ ] Relations added in `packages/db/src/relations.ts` (table + `leadsRelations` + `usersRelations`)
- [ ] Migration **generated**, not hand-written
- [ ] Generated SQL reviewed — contains no `DROP`
- [ ] `npm run db:migrate` applies cleanly
- [ ] `apps/internal/lib/leads/updates.ts` exports `LEAD_UPDATE_TYPES`, `LEAD_UPDATE_LABELS`,
      `LEAD_TOUCH_TYPES`, `LeadUpdateTypeValue`
- [ ] `LeadUpdateRecord` added to `apps/internal/lib/leads/types.ts`
- [ ] No RLS statements
- [ ] Build / lint / type-check pass

---

## Section 03 — Updates timeline UI

**Blocked until A1 is recorded above.**

### Data
- [ ] `apps/internal/lib/queries/lead-updates.ts` exports `listLeadUpdates` (admin-asserted) and
      `fetchLastTouchByLead` (**array input** — C4, avoids board N+1)
- [ ] Last-touch excludes `NOTE` and soft-deleted rows, sourced from `LEAD_TOUCH_TYPES` *(C5)*
- [ ] `apps/internal/lib/data/leads/index.ts` — all four `lastContactAt`/`awaitingReply` sites removed
- [ ] `leads.last_contact_at` and `awaiting_reply` dropped via generated migration *(W5 — after A1)*
- [ ] **Which migration carried the drop:** `________________` — record it here. §03 owns the
      decision but §05 may carry it if it lands first. It must be dropped exactly once.
- [ ] `LeadRecord` drops both fields, gains `lastTouchAt`

### Actions
- [ ] `create-lead-update.ts`, `update-lead-update.ts`, `delete-lead-update.ts` exist
- [ ] Each calls `requireUser()` + `assertAdmin(user)` and verifies the lead exists / not soft-deleted
- [ ] Edit and delete verify the update belongs to the lead in the argument
- [ ] Delete is **soft** — no hard deletes
- [ ] Future `occurredAt` rejected with a validation message
- [ ] `body` trimmed, capped at 5000
- [ ] `LEAD_UPDATE_LOGGED` added to `ActivityVerbs`; event added, re-exported, called on create with
      `targetType: 'LEAD'`

### UI
- [ ] `LeadUpdatesSection` renders below `LeadTasksSection` in `lead-sheet-right-column.tsx` *(D6)*
- [ ] Each entry shows icon **and** label **and** color — color never the sole signal (WCAG 1.4.1)
- [ ] Timeline ordered newest-first by `occurredAt`
- [ ] Last-touch summary, or "No touches logged" when empty
- [ ] All absolute dates via `formatCalendarDate` from `@/lib/dates`
- [ ] Loading skeleton; empty state includes log trigger; **fetch failure renders a retry
      affordance** *(do not copy `LeadTasksSection`'s silent `console.error`)*
- [ ] Composer closes on save; entry appears without full reload
- [ ] Save **not** gated on `isDirty`
- [ ] Logging a `NOTE` does not change last-touch
- [ ] "Add follow-up task" checkbox, unchecked by default; opens task quick-capture prefilled with
      the lead **only after a successful save** *(D21)*
- [ ] No `lead_update_id` column added to `tasks` *(D21)*
- [ ] Follow-up task due date prefills to `today + staleAfterDays` for the lead's stage, editable
      *(D24)*

### Staleness (D19, D22, D23)
- [ ] Thresholds resolved from §06's `fetchLeadStaleThresholds()`; `LEAD_STALE_AFTER_DAYS` used only
      as a per-status fallback *(C14)*
- [ ] `isLeadStale()` takes the threshold map as an argument — does not import the constant
- [ ] Terminal statuses never stale; leads with **no updates** go stale from `createdAt`
- [ ] Staleness dot on the lead card; does not displace or restyle D17's badge *(W11)*
- [ ] Dot has `aria-label` + tooltip — **not color alone** (WCAG 1.4.1)
- [ ] New `leads-board-filters.tsx`: `FilterBar` with follow-up toggle **+ assignee `FilterSelect`**
      + `ResetFiltersButton`, rendered above the board *(D23)*
- [ ] Primitives imported from `@/components/table-toolbar/` — none newly built
- [ ] No status filter, no search box
- [ ] Toggle state in a URL param via `useListParams`; filtering client-side; coexists with
      `useSheetParamSelection('lead')` using `{ scroll: false }`
- [ ] Toggle off by default
- [ ] No `is_stale` column anywhere

### Revalidation
- [ ] `revalidateLeadsPath()` also revalidates `/leads/activity` *(W13)*
- [ ] Build / lint / type-check pass

---

## Section 04 — Lead task placement

**Blocked until A2, A3, and A7 are recorded above.**
**Also blocked on W23:** the time-log CHECK function must be versioned into a migration and amended
to return `false` for null-project tasks *before* this section is approved — reading it is not enough.

### Schema
- [ ] `tasks.project_id` nullable, commented as a data property — **not** described as security
      *(W21)*
- [ ] `tasks_anchor_present` CHECK added with a **bare expression, no `CHECK (...)` wrapper** *(W19)*
- [ ] `destroyLead` soft-deletes the lead's project-less tasks before hard-deleting the lead *(W20)*
- [ ] Permanent lead deletion has a regression test *(W20 — no coverage today)*
- [ ] `time_log_task_matches_project` versioned into a migration and returns `false` for
      null-project tasks; **direct SQL insertion tested**, not just the API guard *(W23)*
- [ ] Migration generated, reviewed, applied; indexes not needlessly rebuilt
- [ ] No RLS statements

### Backfill (W22)
- [ ] `apps/internal/scripts/backfill-lead-task-projects.ts` written, idempotent, logs counts
- [ ] A7 pre-flight count recorded; post-run count matches
- [ ] **Migrated** tasks tested — not just newly created ones — across boards, My Tasks, portal,
      archive, and time logs
- [ ] `loadAssignedTaskSummaries` in `apps/internal/lib/data/tasks.ts`: all four `innerJoin(projects)`
      sites (173, 201, 254, 315) converted to `leftJoin`; row mapper and
      `AssignedTaskSummary['project']` tolerate null *(W18)*

### Creation
- [ ] `create-lead-task.ts` no longer calls `getOrCreateSalesProject`; inserts `projectId: null`
- [ ] Lead-task rank scoped to the **lead** via a lead-aware helper *(W6 — not the project helper
      with a null argument)*
- [ ] `salesProjectId` removed from `payloads.ts`, `resolvers.ts`, `task-sheet-wrapper.tsx`
- [ ] **§01's production dedupe run confirmed above before deleting the script** *(W7)*
- [ ] `apps/internal/lib/leads/sales-project.ts` **deleted** *(W7)*
- [ ] `apps/internal/scripts/dedupe-sales-project.ts` **deleted** *(W7)*
- [ ] `listTasksForLead` returns archived rows; lead sheet Tasks section renders an archived
      grouping *(D18, C11)*

### Behavior
- [ ] Lead-sheet task creation yields `project_id IS NULL` + correct `lead_id`
- [ ] Task appears in the lead sheet's Tasks section
- [ ] Task does **not** appear on any project board
- [ ] Task **does** appear in My Tasks when assigned *(verify `LEFT JOIN`, not inner)*
- [ ] Task sheet shows "Lead task" instead of a project selector
- [ ] Time-logging UI hidden for lead tasks
- [ ] Direct API time-log attempt rejected server-side
- [ ] Archived lead task stays in the lead sheet under an archived grouping; appears in **no**
      project archive *(D18)*
- [ ] Archived rows have a **restore control** reusing the existing task restore action *(PW6)*
- [ ] `SelectTask['projectId']` type ripple worked through — no `!` or `?? ''` silencing *(W15)*
- [ ] Existing project tasks unaffected — boards, ranks, time logs

### Portal regression
- [ ] `apps/client/lib/data/tasks.ts` **not modified**
- [ ] Portal project page shows exactly the tasks it showed before
- [ ] No lead task reachable from any portal surface
- [ ] Build / lint / type-check pass

---

## Section 05 — Lead origination model

**Blocked until A4, A5, A6 are recorded and A5 is signed off.**

### Schema
- [ ] `origination_contact_id` + `origination_user_id` added with `ON DELETE SET NULL` FKs and
      partial indexes
- [ ] `leads_origination_mutex` CHECK added, mirroring `clients_origination_mutex`
- [ ] Additive migration generated and applied — **not hand-edited**
- [ ] `apps/internal/scripts/backfill-lead-origination.ts` written, idempotent, logs counts
- [ ] Backfill matches only names resolving to **exactly one** active contact; prints an ambiguity
      report and exits non-zero if any remain *(W24 — `contacts.name` is not unique)*
- [ ] A8 ambiguity report recorded and resolved
- [ ] Backfill uses **exact** case-insensitive matching — no fuzzy matching *(W8)*
- [ ] All `source_detail` writers removed **before** the delta re-check; DROP ships in a **separate
      release** with a rollback window *(W25)*
- [ ] `contact_leads` rows created for every backfilled origination contact
- [ ] **Separate** destructive migration drops `source_type`, `source_detail`, `lead_source_type` *(W9)*
- [ ] Drop coordination with §03 verified — no double-drop of `last_contact_at`/`awaiting_reply`
- [ ] No RLS statements in either migration

### Application
- [ ] `LEAD_SOURCE_TYPES`, `LEAD_SOURCE_LABELS`, `LeadSourceTypeValue`, `getLeadSourceLabel` removed
- [ ] `LeadRecord` **imports `OriginationMode` from the clients module** — not redeclared *(C8)*
- [ ] `DbLead` at `apps/internal/lib/types.ts:182` updated in lockstep (confirmed present, carries
      `source_type` + `source_detail`)
- [ ] `ClientOriginationPicker` extracted to a shared component, rendered by **both** sheets *(C9)*
- [ ] `lead-card.tsx`, `use-lead-sheet-state.ts`, `lead-sheet/types.ts` migrated off deleted source
      symbols — **build fails if any is missed**
- [ ] Lead card origination badge per D17: **Referral** / **Partner** as label, name on hover, same
      slot/styling *(W11)*
- [ ] Picker's **option loader extracted with it**; lead sheet uses the shared self-fetch, not a
      widened sheet-init payload *(C12)*
- [ ] `PartnerUserOption` / `OriginationContactOption` moved beside the shared picker; no
      `LeadAssigneeOption` mapping at the lead call site *(C13)*
- [ ] Archived-assignee guard: conversion succeeds with a `warnings[]` entry rather than aborting
      *(W12)*
- [ ] `contact_leads` clearing is a hard delete; no `deletedAt` added *(W14)*
- [ ] **Leads-scoped** verification grep returns nothing:
      `grep -rn "sourceType\|sourceDetail" apps/internal/lib/leads apps/internal/app/\(dashboard\)/leads packages/db --include="*.ts" --include="*.tsx"`
      *(an unscoped grep always hits `form_submissions`, which is a different concept and out of
      scope)*
- [ ] `save-lead.ts` enforces the mutex in the action; selecting one mode clears the other
- [ ] `contact_leads` row created on set, removed on clear/change

### Conversion
- [ ] External referrer → `clients.origination_contact_id` set
- [ ] Internal partner → `clients.origination_user_id` set
- [ ] `clients.closer_user_id` set from the lead's assignee *(D16)*
- [ ] Existing-client path does **not** overwrite non-null values; adds a `warnings[]` entry when
      skipped *(C10)*
- [ ] Unassigned lead → `closer_user_id` null, no error
- [ ] Monthly-close origination and partner-payout reports render for a newly converted client

### Route removal
- [ ] `app/api/integrations/leads-intake/` deleted
- [ ] Removed from `apps/internal/proxy.ts`
- [ ] `LEADS_INTAKE_TOKEN` removed from `turbo.json` and `.env.example`
- [ ] **CLAUDE.md "Lead Intake Webhook" section deleted**
- [ ] `scripts/test-form-intake.ts` **left in place** — verified during PRD authoring to target
      `audit-responses` / `contact-submissions`, not `leads-intake`
- [ ] Jason notified to remove `LEADS_INTAKE_TOKEN` from Vercel — **implementer does not do this**
- [ ] Build / lint / type-check pass

---

## Section 06 — Lead settings

**Blocks §03** — D19's staleness thresholds resolve from this table.

### Schema
- [ ] `lead_stage_settings` added: `status` unique, nullable `stale_after_days`, timestamps, **no**
      `deletedAt` *(matches `tax_rates`, not a singleton — W16)*
- [ ] Migration generated and applied — **not hand-edited**
- [ ] `apps/internal/scripts/seed-lead-stage-settings.ts` written with
      `INSERT … ON CONFLICT (status) DO NOTHING`, idempotent
- [ ] Seeds exactly `NEW_OPPORTUNITIES` 3, `ACTIVE_OPPORTUNITIES` 7, `PROPOSAL_SENT` 7, `ON_ICE` 30
- [ ] Terminal statuses get **no row**
- [ ] Re-running the migration does not overwrite tuned values
- [ ] No RLS statements

### Data + action
- [ ] `fetchLeadStaleThresholds()` exists, `cache()`-wrapped, returns a status-keyed map
- [ ] Resolution order: row → `LEAD_STALE_AFTER_DAYS` fallback → never stale *(C14)*
- [ ] `saveLeadStageSettings` calls `requireUser()` + `assertAdmin(user)`
- [ ] Zod rejects `0`, negatives, and > 365; accepts null
- [ ] UPSERT on the `status` unique constraint
- [ ] Revalidates **both** `/leads` and `/leads/settings` *(W17)*

### UI
- [ ] `Settings` tab in `LEADS_TABS`, between Leads and Archive (matches `INVOICES_TABS`)
- [ ] `/leads/settings` under `PageShell`, `activeTab='settings'`, `requireRole('ADMIN')`
- [ ] One input per non-terminal stage; terminal stages read-only as "Never"
- [ ] Helper copy states that notes don't count toward follow-up *(C5)*
- [ ] Save **not** gated on `isDirty`
- [ ] Saving a threshold changes the board's dots without a manual refresh
- [ ] Build / lint / type-check pass

---

## Review codes

**Defined in [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md)** — C1–C14 and W1–W26, with the
cross-cutting themes, the retracted I1, the migration-edit policy correction, and open risks.
**W18–W26 came from the PR #141 multi-reviewer pass and include two defects that would have broken
implementation.** Codes are cited inline in the checklists above and throughout
the section files; that file is the definition of record.

---

## Session log

| Date | Sections | What changed | Notes |
| --- | --- | --- | --- |
| 2026-08-13 | — | PRD authored | Phase 1: 22 files scanned, 10 questions resolved, 0 repeat asks |
| 2026-08-13 | — | Consistency check | 15 inconsistencies fixed; D17/D18 added; C11/W11 added; ARCHITECTURE-REVIEW.md split out of this file |
