# 02 — Time Logs on the Task Sheet

**Depends on:** [01-task-sheet-stay-open.md](01-task-sheet-stay-open.md) (create→edit transition makes the section available right after create)
**App:** `apps/internal/`
**Decisions:** D4, D5 (see [README.md](README.md))
**Review codes:** C4, C5, C6, W3, W4, W5, W6, W14, I5, R3, R6 (see [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

## Problem

The only place to log hours today is the project burndown widget's "Add" button
([project-burndown-widget.tsx](<../../../apps/internal/app/(dashboard)/projects/_components/project-burndown-widget.tsx>) ~L95–103
→ `openCreateTimeLogDialog`). From My Tasks there is **no path at all** — you must navigate to the
project board first. And a task gives no visibility into hours already logged against it: the
task→log linkage (`time_log_tasks`) is only ever read from the log side
([listProjectTimeLogs](../../../apps/internal/lib/queries/time-logs/read.ts) ~L77+); **no by-task
query exists**. Ask: "Log hours from the task sheet (…especially my tasks screen…) " + addendum
"tasks should surface time logs that are already logged against it in a list."

## Fix

Add a **Time section** to the task sheet, rendered only in edit mode (persisted task):

1. A list of time logs linked to this task — per row: date (`loggedOn`), hours, who logged it,
   truncated note — with a **total hours** line. Rows are clickable and open the existing
   `ProjectTimeLogDialog` in **edit mode** (same as the project Time Logs tab).
2. A **"Log time" button** that opens the same dialog in **create mode** with this task pre-linked
   and the project fixed to the task's project.

All validation (hours > 0, date), the prepaid **overage confirm**, closed-month warnings (PRD 002 §05),
and activity logging come for free by reusing the dialog + its mutation hook.

## Implementation

### 1. Query — `listTaskTimeLogs`

[apps/internal/lib/queries/time-logs/read.ts](../../../apps/internal/lib/queries/time-logs/read.ts):

```ts
// timeLogTasks (deletedAt IS NULL, taskId = ?) INNER JOIN timeLogs (deletedAt IS NULL)
// LEFT JOIN users (logger identity: id, fullName, avatarUrl)
// ORDER BY timeLogs.loggedOn DESC, timeLogs.createdAt DESC
// select: timeLog id, projectId, userId, hours, loggedOn, note, createdAt, updatedAt
```

Return rows shaped for the section AND for seeding the dialog's edit mode — the edit dialog expects
the full `TimeLogEntry` (`TimeLogWithUser & { linked_tasks }`, see
[lib/projects/time-log/types.ts](../../../apps/internal/lib/projects/time-log/types.ts) ~L44–55),
including the log's *other* linked tasks.

**(C6) Prerequisite refactor — the hydration path must be extracted first.** There is no reusable
hydration helper today: the linked-task fetch, `linkedTasksByLog` map, and row→`TimeLogEntry`
mapping are all inline inside `listProjectTimeLogs` (~L118–178). Extract a
`hydrateTimeLogEntries(logIds)` helper, refactor `listProjectTimeLogs` to call it, then implement
`listTaskTimeLogs(user, taskId)` as: `ensureTaskAccess(user, taskId)` **inside the query, first
line** — matching the sibling convention (`listProjectTimeLogs` opens with `ensureProjectAccess`),
so any future server-side caller inherits the guard rather than relying on the route (R3) — then
fetch matching log ids via `time_log_tasks` (`taskId = ?`, `deletedAt IS NULL` on both join and
log) → hydrate via the shared helper.

**(C6, deliberate bug fix)** the current inline linked-tasks query filters only by
`inArray(timeLogTasks.timeLogId, …)` — it is **missing `isNull(timeLogTasks.deletedAt)`**, so
soft-deleted links leak into `linked_tasks` and the edit dialog re-selects previously unlinked
tasks. Add the filter in the extracted helper. This intentionally changes Time Logs tab edit
behavior for affected logs (it's a live-bug fix; regression-tested in TEST-PLAN R.2).

Compute `totalHours` server-side (numeric strings from `numeric(8,2)` — sum with a SQL aggregate,
not JS float addition; note row `hours` is exposed as `number` via `Number(...)` mapping ~L159).

### 2. API route — `GET /api/tasks/[taskId]/time-logs`

New: `apps/internal/app/api/tasks/[taskId]/time-logs/route.ts`, following the existing
`app/api/tasks/[taskId]/{comments,summary}` conventions exactly **(W3 — these routes return bare
payloads, NOT an `{ ok, data }` envelope)**:

- `const user = await getCurrentUser()` → 401 `{ error: 'Unauthorized' }`
- zod `paramsSchema = z.object({ taskId: z.string().uuid() })` over `await context.params` → 400
- Calls `listTaskTimeLogs(user, taskId)` — the guard (`ensureTaskAccess`) lives **inside the
  query** (R3). **(I5)** the admin assert is transitive via `ensureProjectAccess`, and it can throw
  `NotFoundError` for the task *or* project; catch `HttpError` generically and map `error.status`
  (as the sibling routes do), don't assume a fixed 403/404 pair
- Returns bare `{ entries, totalHours }`

### 3. Client hook — `use-task-time-logs.ts`

New: `apps/internal/app/(dashboard)/projects/_components/task-sheet/use-task-time-logs.ts`
React Query: key `['task-time-logs', taskId]`, `enabled: Boolean(taskId) && open`. Invalidate this
key after any dialog save/delete (see §5). **(W14)** the global QueryClient default is
`staleTime: 60_000` — set `staleTime: 0` **explicitly** on this query (logs change from other
surfaces). Closest existing patterns: `use-project-time-log-history.ts` and the co-located
`use-task-deployments.ts` / `use-plan-revisions.ts`.

### 4. UI — `time-log-section.tsx`

New: `apps/internal/app/(dashboard)/projects/_components/task-sheet/time-log-section.tsx`, rendered
from [task-sheet.tsx](<../../../apps/internal/app/(dashboard)/projects/task-sheet.tsx>) in the left
column **directly below the form fields and above any comments/attachments content** (owner
decision: time sits next to the task's core details at a predictable spot), only when `props.task`
exists and the task's project is resolvable (`taskProject` is computed in the sheet ~L221–226).

- Header row: `Time` label, total (`{totalHours}h logged`), and the **Log time** button.
- List: each row a button — `loggedOn` (formatted), `hours`h, logger name (avatar optional), note
  truncated to one line. Empty state: "No time logged yet."
- Loading: small skeleton; error: quiet inline message (the sheet must not break).
- **Log time disabled states (D4, C5):** disabled with tooltip when (a) the form's project field
  differs from the persisted `task.projectId` (unsaved project change — the DB check
  `time_log_tasks_project_match` in `packages/db/src/schema.ts` ~L867–870 makes the *persisted*
  project authoritative; watch the form's project value and compare), or (b) the task is
  **archived/deleted**. **Accepted tasks keep the button enabled** — the pre-linked task bypasses
  the selector's eligibility filter (owner decision, C5): "should apply to all tasks." The section
  simply doesn't render in create mode, which covers the unsaved-task case.

### 5. Dialog mounting + pre-linking

`ProjectTimeLogDialog` ([project-time-log-dialog.tsx](<../../../apps/internal/app/(dashboard)/projects/_components/project-time-log/project-time-log-dialog.tsx>))
is prop-driven via `ProjectTimeLogDialogParams`
([types.ts](../../../apps/internal/lib/projects/time-log/types.ts) ~L10–22): `projectId, projectName,
projectType, clientId, clientName, clientBillingType, clientRemainingHours, tasks, currentUserId,
projectMembers, admins`. All of it derives from `ProjectWithRelations`
([lib/types.ts](../../../apps/internal/lib/types.ts) ~L228–237: `client`, `members`, `burndown` — all
non-optional), which both My Tasks (`projects` prop) and the board already hold client-side.

- **(W4) The param construction to extract lives in
  [projects-board-dialogs.tsx](<../../../apps/internal/app/(dashboard)/projects/_components/projects-board-dialogs.tsx>) L94–110**
  (inline JSX props on `<ProjectTimeLogDialog>`), NOT in `use-board-time-log-dialogs.ts` (that hook
  is open/close/mode state only). Extract a helper in `lib/projects/time-log/` with signature
  roughly `(project: ProjectWithRelations, extras: { tasks, currentUserId, admins }) =>
  ProjectTimeLogDialogParams`. Note the board passes `tasks` from `activeProjectTasks` (wired in
  `use-projects-board-view-model.ts` ~L201–209), which may be view-filtered — from the task sheet
  pass `taskProject.tasks` and verify the divergence is acceptable.
- **(W4) Build the params LAZILY, inside the `props.task &&` branch.** The lead overlay's
  `/api/leads/task-sheet-init` payload isn't guaranteed to satisfy every `ProjectWithRelations`
  field access — eager building at the top of `task-sheet.tsx` can crash it on
  `burndown.totalClientRemainingHours`. The overlay never renders the section (create-only), so
  lazy construction sidesteps the problem entirely.
- **(C5) Pre-link — three required mechanics**, all in
  [use-project-time-log-dialog.ts](../../../apps/internal/lib/projects/time-log/use-project-time-log-dialog.ts):
  1. Add `initialLinkedTaskIds?: string[]` to the options. Seed via a **dedicated effect keyed on
     `open && !isEditMode`** — do NOT rely on `handleDialogOpenChange(true)` (~L443–457): Radix only
     fires `onOpenChange` on user interaction, not programmatic `open`, so that path never runs for
     a parent-opened dialog. (Edit mode already has its own effect ~L219–263.)
  2. Seed **both** `initializeSelection(ids)` AND `setBaselineState({ …, taskIds: ids })` —
     `isFormDirty` (~L395–410) compares selection to baseline, so seeding only the selection makes
     an untouched dialog instantly dirty (discard confirm on plain close).
  3. The eligibility filter in
     [time-log-task-selection.ts](../../../apps/internal/lib/projects/time-log/time-log-task-selection.ts)
     (`eligibleTasks` ~L32–52) excludes `deleted_at`, `ARCHIVED`, **and `accepted_at IS NOT NULL`**
     tasks — a pre-linked accepted task would silently show unselected. Per the owner decision: the
     pre-linked id bypasses the filter (render it as a selected, non-removable-without-confirm chip
     exactly like edit mode's existing linked tasks); archived/deleted tasks never reach here (the
     button is disabled).
- **Edit:** row click opens the dialog with the fetched `TimeLogEntry` (same call shape as the Time
  Logs tab's `onEditEntry` → `openEditTimeLogDialog(entry)`).
- **(W5, owner decision) Delete ships in the dialog's edit mode:** a confirm-guarded Delete button
  reusing the existing `DELETE /api/projects/[projectId]/time-logs/[timeLogId]` endpoint and
  activity event (the delete flow pattern lives in `use-project-time-log-history.ts`). This gives
  the Time Logs tab the same affordance for free.
- **(W6) After save/delete:** the mutation hook
  ([use-project-time-log-mutation.ts](../../../apps/internal/lib/projects/time-log/use-project-time-log-mutation.ts))
  already closes the dialog, toasts, and `router.refresh()`es (~L204), and invalidates only
  `[TIME_LOGS_QUERY_KEY, projectId]` — the new key is NOT covered. Thread an optional `onSuccess`
  through **three** files: `use-project-time-log-mutation.ts` (options ~L21–44),
  `use-project-time-log-dialog.ts` (options ~L25–29), and `project-time-log-dialog.tsx` (props
  ~L18–23) → the task sheet invalidates `['task-time-logs', task.id]`.
- **(C4) The `router.refresh()` in that onSuccess fires while the task sheet is open** — this is
  the interaction that makes 01's "reset only when `task?.id` changes" rule mandatory. With that
  rule in place, logging time never wipes unsaved task-form edits. Test 02.E6 covers it.
- `TaskSheet` already receives `admins: DbUser[]` and `projects: ProjectWithRelations[]` (props
  ~L35–49) from all three consumers — verified; no threading needed. My Tasks caveat: `taskProject`
  resolves against `props.projects`, so the section depends on 01's C1 fix to render for tasks
  outside the assigned set.

## Architecture notes

- No schema changes. The `time_log_tasks` unique-per-`(timeLogId, taskId)` + project-match check
  constraints are the invariants this UI leans on.
- **(R6) Server-side task-eligibility validation.** The button-disable and eligibility filter are
  client-only; the write API accepts arbitrary `taskIds` and `createTimeLog` checks only project
  access — a task archived or soft-deleted *after* the dialog opens (or a hand-crafted request)
  could still be linked. Add in-transaction validation to `createTimeLog`/`updateTimeLog`
  (`apps/internal/lib/queries/time-logs/mutations.ts`): every linked task must exist, belong to the
  log's project, have `deletedAt IS NULL`, and not be status `ARCHIVED`; **accepted tasks are
  explicitly allowed** (matching the C5 pre-link exception). Violations return a 400 with a
  field-level message so the dialog can surface "task no longer available".
- Logging time for **another user** stays possible — the dialog's "Log hours for" combobox is
  unchanged.
- The lead task overlay never shows the section (create-only + `closeOnSave`; a task never persists
  while that overlay is open).

## Acceptance criteria

- [ ] Task sheet (edit mode) shows a Time section: linked logs list (date, hours, logger, note) + total hours
- [ ] Section absent in create mode; appears immediately after 01's create→edit transition
- [ ] "Log time" opens the dialog with this task pre-linked and the project fixed; saving creates a `time_logs` row + `time_log_tasks` link; list and total update without reopening the sheet
- [ ] Overage confirm still triggers for prepaid clients when hours exceed remaining (and is skipped for INTERNAL/PERSONAL projects and net_30 clients)
- [ ] Clicking a row opens the dialog in edit mode; edits reflect in the list
- [ ] The dialog's edit mode has a confirm-guarded Delete (W5); deleting removes the row and recalculates the total, and the same Delete works from the Time Logs tab
- [ ] "Log time" is disabled (with tooltip) while the project field has an unsaved change; re-enabled after save/revert
- [ ] "Log time" works on an **accepted** task (pre-linked chip present, C5); disabled on an archived task
- [ ] Opening the pre-linked create dialog and closing it untouched does NOT prompt to discard (C5 baseline seeding)
- [ ] Logging time while the task form has unsaved edits does NOT wipe those edits (C4)
- [ ] The time-log API rejects linking soft-deleted or ARCHIVED tasks server-side; accepted tasks are allowed (R6)
- [ ] Works identically from My Tasks and from the project board task sheet
- [ ] A log linked to multiple tasks appears on each linked task's sheet; editing from one is visible from the other
- [ ] Activity events for create/edit/delete still fire (existing hook path)
- [ ] Burndown-widget Add flow and Time Logs tab unchanged
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root

## Files

**New:**
- `apps/internal/app/api/tasks/[taskId]/time-logs/route.ts`
- `apps/internal/app/(dashboard)/projects/_components/task-sheet/time-log-section.tsx`
- `apps/internal/app/(dashboard)/projects/_components/task-sheet/use-task-time-logs.ts`

**Modified:**
- `apps/internal/lib/queries/time-logs/read.ts` — extract `hydrateTimeLogEntries` (+ `deletedAt` bug fix, C6), add `listTaskTimeLogs` (guard inside, R3)
- `apps/internal/lib/queries/time-logs/mutations.ts` — in-transaction linked-task eligibility validation (R6)
- `apps/internal/lib/projects/time-log/use-project-time-log-dialog.ts` (+ `types.ts`) — `initialLinkedTaskIds` seeding effect + baseline (C5), delete wiring (W5)
- `apps/internal/lib/projects/time-log/time-log-task-selection.ts` — pre-linked eligibility exception (C5)
- `apps/internal/lib/projects/time-log/use-project-time-log-mutation.ts` — `onSuccess` callback (W6)
- `apps/internal/app/(dashboard)/projects/_components/project-time-log/project-time-log-dialog.tsx` — `onSuccess` prop (W6), edit-mode Delete button (W5)
- `apps/internal/app/(dashboard)/projects/_components/projects-board-dialogs.tsx` — extract shared param-builder from L94–110 (W4)
- `apps/internal/app/(dashboard)/projects/task-sheet.tsx` — section + lazy dialog mount (W4)
