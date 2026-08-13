# PRD 005 — Architecture Review

Review codes referenced inline throughout the section files. **C#** = a constraint or invariant the
implementation must hold. **W#** = a warning about a trap, a deliberate divergence, or a thing that
looks wrong but isn't.

Codes are cited in section files as *(C4)* / *(W9)* and repeated in
[PROGRESS.md](PROGRESS.md)'s checklists. This file is the definition of record.

---

## Cross-cutting themes

Three patterns recur across this PRD and are worth naming before the individual codes.

### 1. Values that are safe only because of where they happen to live

Both headline defects are this shape. The phantom `Sales Strategy` project is harmless *until* the
cleanup script runs, at which point it 500s the task sheet. Lead tasks are private *until* they move
onto a client project. In each case an implicit arrangement of data is doing the work a constraint
should do. C1, C2, and C6 are the specific instances.

### 2. Read paths that make dead code look implemented

`leads.last_contact_at` and `awaiting_reply` are read at four sites and written at zero.
`contact_leads` has a table, a unique constraint, and two indexes, and is referenced only by two type
exports. Grepping for *references* finds these; grepping for *writers* is what exposes them. W5
encodes the resulting rule: verify the write-never claim against production data before acting on it.

### 3. Two copies of one idea

`getOrCreateSalesProject` existed twice and diverged, which is the entire cause of §01. §05 is at
risk of repeating it with two origination pickers, and §02–§03 with two definitions of "which update
types count as a touch." C1, C5, C8, and C9 are the same lesson at four sites.

---

## Constraints (C)

| # | Section | Constraint |
| --- | --- | --- |
| **C1** | [01](01-sales-project-defect.md) | **The §01 defect is a missing constraint, not a typo.** Two functions could diverge because nothing tied "where lead tasks live" to a single definition. The fix is the shared module; correcting the slug alone would leave the divergence possible. |
| **C2** | [01](01-sales-project-defect.md) | **`idx_projects_slug` ignores `deleted_at`.** It is `UNIQUE` on `slug WHERE slug IS NOT NULL` (`packages/db/src/schema.ts:433-435`) while every application query filters `deleted_at IS NULL`. Any find-or-create by slug against `projects` has the same trap: the `SELECT` misses a soft-deleted row that the `INSERT` then collides with. |
| **C3** | [02](02-schema-lead-updates.md) | **`occurred_at` must be indexed alongside `lead_id`, not separately.** The timeline render and the last-touch aggregate both filter by lead and order/aggregate by `occurred_at`. One composite serves both; two single-column indexes serve neither well. |
| **C4** | [03](03-updates-timeline-ui.md) | **`fetchLastTouchByLead` takes an array, not a single id.** `lastTouchAt` lives on the shared `LeadRecord` type, which the board's query hydrates for every visible lead across seven columns. A per-lead call would be an N+1 on the highest-traffic page in the section — *even though the card does not display the value* (see W11). |
| **C5** | [03](03-updates-timeline-ui.md) | **The `NOTE` exclusion is load-bearing and must have one source.** It appears in `LEAD_TOUCH_TYPES`, in the last-touch SQL, and in empty-state copy. Import the constant into the query; do not re-list the literal values, including in code the PRD shows as illustrative SQL. |
| **C6** | [04](04-lead-task-placement.md) | **Null-as-portal-invisibility is a real guarantee and an implicit one.** `apps/client/lib/data/tasks.ts` selects with `eq(tasks.projectId, projectId)`; SQL equality never matches `NULL`, so lead tasks cannot reach the portal. Document it at the column and in the portal query so a future null-tolerant "fix" reads as an obvious red flag. This is what makes D12's deferral safe. |
| **C7** | [04](04-lead-task-placement.md) | **`time_log_task_matches_project` is unknown code.** Its body is not in this repository — it predates the Drizzle baseline and exists only in the live database. A `CHECK` constraint **passes** on `NULL`, so if the function dereferences `project_id` without a null guard it may silently permit the time-log linkage D10 forbids. Read it (audit A3) before assuming the database enforces anything. |
| **C8** | [05](05-lead-origination-model.md) | **Mirror the clients origination model; do not map between two shapes.** D13's entire justification is that lead and client origination are identical, making conversion a field copy. Any lead-side-only field reintroduces a translation layer and the drift it brings. |
| **C9** | [05](05-lead-origination-model.md) | **Extract the origination picker; do not copy it.** Two visually identical pickers that must stay in sync is §01's failure mode with a different file name. `ClientOriginationPicker` is already fully prop-driven, so extraction is mechanical. |
| **C10** | [05](05-lead-origination-model.md) | **Never overwrite existing client attribution on conversion.** `origination_*` and `closer_user_id` feed the monthly-close origination and partner-payout reports. Per the billing-terms/close-locking precedent, a mutable field must not silently change what a historical report reads. Fill only nulls; warn on skip. |
| **C11** | [04](04-lead-task-placement.md) | **Archived lead tasks have no project archive to live in.** Project archive routes are project-scoped (`/projects/[clientSlug]/[projectSlug]/archive`) and a lead task has no project. The lead sheet's Tasks section is their only home and must render an archived grouping **with a restore control**, or archiving becomes an irreversible disappearance through the UI. |
| **C12** | [05](05-lead-origination-model.md) | **The lead sheet has no contacts on any path.** `SheetInitPayloads['lead']` is `{lead, assignees, senderName}` (`payloads.ts:63-67`); `resolveLeadInit` returns the same (`resolvers.ts:216-226`); `/leads` passes only `assignees` (`leads-workspace.tsx:166`). The origination picker cannot render without a specified source. **Resolution:** extract the client sheet's self-fetch (`use-client-sheet-state/form-state.ts:225-300`) alongside the picker — a repo-wide grep for `allContacts=` returns zero call sites, so that fetch is already the only production path. Do **not** widen the sheet-init payload, which serves every dashboard sheet. |
| **C13** | [05](05-lead-origination-model.md) | **`PartnerUserOption` and `LeadAssigneeOption` are different shapes** — `{id, fullName, email}` vs `{id, name, email, avatarUrl}`. The shared picker types `availableUsers` as the former; the lead sheet holds the latter. **Resolution:** move both option types beside the extracted picker and have the shared loader produce them for both sheets. Mapping at the lead call site would be exactly the translation layer C8 forbids. |
| **C14** | [06](06-lead-settings.md) | **`LEAD_STALE_AFTER_DAYS` becomes a fallback, not dead code.** Once `lead_stage_settings` exists it is tempting to delete the constant — don't. A missing row, a failed fetch, or a fresh database would then silently disable staleness, which looks exactly like the feature working correctly on a quiet board. Resolution order is row → constant → never stale. |

---

## Warnings (W)

| # | Section | Warning |
| --- | --- | --- |
| **W1** | [01](01-sales-project-defect.md) | **§01 is a deliberate stopgap.** §04 removes the concept of a default lead-task project entirely, deleting `sales-project.ts` and the `salesProjectId` payload field. Keep the new module small and obviously deletable; build nothing on top of it. |
| **W2** | [02](02-schema-lead-updates.md) | **`author_id` uses `RESTRICT` where `task_comments` uses `CASCADE`.** Intentional: an update is an audit record of who contacted whom, and users are disabled (`disabled_at`) rather than deleted in this codebase. Do not "fix" this for consistency with `task_comments`. |
| **W3** | [02](02-schema-lead-updates.md) | **No database-level `body` length cap.** Consistent with `task_comments.body`; the §03 server action enforces a Zod max instead. Add a constraint only if abuse becomes real. |
| **W4** | [03](03-updates-timeline-ui.md) | **Do not reuse `TaskComments` data fetching.** It is bound to `taskId` and the comment API routes. Sharing a presentational row behind a clean prop boundary is fine; sharing the fetching layer is not. |
| **W5** | [03](03-updates-timeline-ui.md) | **Verify write-never before dropping.** The `last_contact_at` / `awaiting_reply` drops rest on a claim about production data (audit A1). A non-zero count means something writes them and §03's premise is wrong — stop and re-investigate rather than dropping anyway. |
| **W6** | [04](04-lead-task-placement.md) | **Rank scope changes meaning.** Task ranks are currently unique within project+status; for lead tasks the scope becomes lead+status. Add a lead-aware helper — do not pass `null` into the project-scoped `resolveNextTaskRank` and hope. |
| **W7** | [04](04-lead-task-placement.md) | **§01's artifacts are meant to die in §04.** Deleting `apps/internal/lib/leads/sales-project.ts` and `apps/internal/scripts/dedupe-sales-project.ts` is part of §04's scope, not leftover cleanup debt. **The dedupe script must have been run in production before §04 deletes it** — otherwise the phantom-project cleanup is lost along with the tool that performs it. |
| **W8** | [05](05-lead-origination-model.md) | **Exact-match backfill only.** No fuzzy or partial name matching. A false referrer attribution flows into the client's origination and then into partner payouts — worse than no attribution at all. |
| **W9** | [05](05-lead-origination-model.md) | **Split additive and destructive migrations.** The origination columns + backfill land in one migration; the `source_type` / `source_detail` / enum drops land in a second. The additive half must be deployable and verifiable before anything is destroyed. |
| **W10** | [05](05-lead-origination-model.md) | **Historical activity metadata is immutable.** Old `sourceType` values inside `activity_logs` JSONB stay exactly as they are. It is an audit trail; do not migrate it. |
| **W11** | [05](05-lead-origination-model.md) | **The lead card's origination badge is a display, not a second source of truth.** It replaces the removed source badge and reads from the same `LeadRecord` origination fields the sheet uses. It must not introduce its own resolution logic. Labels are **Referral** (external contact) / **Partner** (internal admin user) per D17. |
| **W12** | [05](05-lead-origination-model.md) | **D16 can abort the entire conversion.** `createClient` calls `assertClientPartnerUserRoles` (`create-client.ts:55-61`), which errors out when the referenced user is archived (`deleted_at IS NOT NULL`) or non-ADMIN. Role is safe — `fetchLeadAssignees()` → `fetchAdminUsers()` — but converting an older lead whose assignee was since archived fails with *"Selected partner user is archived"*, about a field the user never touched. **Resolution:** guard before copying; null the closer and push a `warnings[]` entry instead of letting `createClient` abort. Same guard for an archived origination user. |
| **W13** | [03](03-updates-timeline-ui.md) | **`revalidateLeadsPath()` misses `/leads/activity`.** It revalidates only `/leads` and `/leads/archive`, but `createLeadUpdate` writes a `LEAD_UPDATE_LOGGED` activity event. **Resolution:** add `revalidatePath('/leads/activity')` to the helper — every existing lead action has the same gap and benefits. |
| **W14** | [05](05-lead-origination-model.md) | **`contact_leads` has no `deletedAt`** (`schema.ts:315-342`), so clearing a referrer is a hard `DELETE`. This is correct — `contact_clients` is built identically, making hard-delete the established convention for pure link tables here. **Do not add `deletedAt`.** TEST-PLAN X11 ("no hard deletes introduced") carries an explicit carve-out. |
| **W15** | [04](04-lead-task-placement.md) | **`taskFields.projectId` becomes `string \| null` for every `SelectTask` consumer** (`queries/tasks/common.ts:7`), not just the queries §04 targets. This is where the compiler surfaces the change, and that is useful — each error is a call site that must decide what a project-less task means. **Do not silence with `!` or `?? ''`;** narrow explicitly. `tasksRelations.project` needs no change — Drizzle handles a nullable FK on the `one` side. |
| **W16** | [06](06-lead-settings.md) | **Do not build this as a singleton settings table.** Older PRD notes describe a "singleton with a CHECK locking the PK to a sentinel UUID (see `billing_settings`)" — **no such table exists in this schema.** A repo-wide grep for `_settings` as a table name returns nothing; that pattern was designed in PRD 002 and never shipped. The real precedent is `tax_rates`: a small keyed config table. One row per lead status also survives a new status without an `ALTER TABLE`. |
| **W17** | [06](06-lead-settings.md) | **Threshold changes must revalidate the board.** `saveLeadStageSettings` revalidates both `/leads` and `/leads/settings`. A stale `/leads` cache after saving makes the setting look broken — the dots wouldn't move until something else invalidated the page. |

---

---

## Verified-clear (audit, informational)

Claims checked against the codebase that turned out **better** than the PRD assumed. Recorded so
nobody spends time re-verifying them.

| # | Finding |
| --- | --- |
| **I1** | My Tasks already uses `leftJoin(projects, …)` / `leftJoin(clients, …)` (`queries/tasks/summaries.ts:97-98`). §04's headline "an inner join silently drops lead tasks" risk is largely pre-mitigated on the main path. |
| **I2** | `apps/internal/lib/activity/events.ts:8` is `export * from './events/leads'`, so §03's "re-export from events.ts" step is a **no-op** — adding the event to `events/leads.ts` is sufficient. |
| **I3** | `projects` has **no** origination fields. Kris's *"carries over to the project when created"* can only mean the client record, which is what §05 implements. Not an oversight. |
| **I4** | The inline FK to `contacts` is valid for `leads` (line 931, after `contacts` at 233). The migration-based workaround noted at `schema.ts:223` exists only because `clients` (~line 155) precedes `contacts` — **do not copy it**. |
| **I5** | `leadsRelations` already declares `contactLeads: many(contactLeads)` (`relations.ts:171`). Reviving the table needs no change on that side. |

---

## Product review

Evaluated against the agency's public positioning (placetostandagency.com): custom software for
mid-market clients, explicitly **no account managers** — clients work directly with builders.

| # | Finding | Resolution |
| --- | --- | --- |
| **P1** | **The PRD measured cadence backwards only.** "Last touched 12 days ago" lived in the sheet, and D17 kept it off the board — so nothing anywhere answered *"who is overdue right now?"* For founders selling between builds, that is the half that drives action; without it, logging updates is a chore producing an unread number. | **D19** — staleness dot on the card (separate from D17's badge, so density holds) plus a "Needs follow-up" board filter, thresholded per stage. Specced in [03](03-updates-timeline-ui.md). |
| **PW4** | **`EMAIL` invites duplicate entry.** Gmail OAuth sync already exists (`api/cron/gmail-sync`). Hand-logging emails beside a live integration is the kind of double entry people abandon — and an abandoned last-touch is *wrong*, which is worse than absent. | **D20** — keep it manual for now (Gmail is not wired to leads at all, so auto-derivation is its own project). Recorded in [06](07-future-scope.md) as the first candidate to automate, with the rule that a synced signal must supersede a manual one rather than double-count. |
| **PW5** | **Nothing connected an update to a task.** The natural motion is *log a call → create a follow-up*, and D11 removed the presets that would scaffold it. | **D21** — optional "Add follow-up task" checkbox on the composer, opening task quick-capture prefilled with the lead. Workflow shortcut only; **no schema link** (the third option, a `lead_update_id` column, was rejected as solving an unasked question). |
| **PW6** | **D18's restore path was tested but never specced.** TEST-PLAN 4.10b exercised restore; §04 only described a collapsed grouping. Restore is the entire point of C11. | Restore control now required in [04](04-lead-task-placement.md), reusing the existing task restore action. |
| **PI1** | Badge label vocabulary sits on every card all day. | Confirmed **Referral** / **Partner** (D17), matching the schema's own language — *"internal sourcing partners"* vs *"external referrers with IC agreements"*. |
| **PI2** | **Nothing client-facing changes, correctly.** The client portal is untouched. For an agency whose portal *is* its client experience, keeping lead-stage machinery out of it is the right call — noted so a future section doesn't drift into it. | No action. |

---

## Open risks

Carried into implementation rather than resolved here.

| Risk | Section | Mitigation |
| --- | --- | --- |
| The `time_log_task_matches_project` function may not enforce what D10 assumes | 04 | Audit A3 reads the body before any migration; the application-layer guard is the actual enforcement |
| `source_detail` drop is irreversible with no preservation column (D15) | 05 | Pre-flight audit A5 plus explicit sign-off is the only review gate |
| Four migrations generated across parallel branches will race for numbering (02 and 04 add one each; 05 adds two per W9) | 02, 04, 05 | Rebase and regenerate; never renumber by hand — `meta/_journal.json` desynchronizes |
| Deleting the dedupe script before it has run in production loses the cleanup | 04 | W7; PROGRESS records the §01 run before §04 begins |
| **§03 and §05 both modify `lead-card.tsx`** — the staleness dot (D19) and the origination badge (D17) land in the same component, and the README marks these sections parallelizable | 03, 05 | Whichever lands second rebases. Neither owns the file; the dot must not displace or restyle the badge (W11) |
| Staleness thresholds are a guess until real usage exists | 03 | `LEAD_STALE_AFTER_DAYS` is a single exported constant — tune it in one place once the team has opinions |
