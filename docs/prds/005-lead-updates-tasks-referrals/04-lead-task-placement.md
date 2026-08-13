# 04 — Lead Task Placement

**PRD:** [005](README.md) · **Complexity:** High · **Schema:** Yes · **App:** `apps/internal`
**Depends on:** [01-sales-project-defect.md](01-sales-project-defect.md) · **Blocks:** Nothing
**Decisions:** [D8, D9, D10, D11, D12](README.md#key-decisions)

---

## Problem

Kris: *"I don't like the current structure of tasks in a lead adding to a hardcoded project that
actually no longer exists."*

Section 01 fixes the crash and the divergence, but leaves the underlying model intact: every task
created from a lead is forced into an internal `Sales` project it has no real relationship with.
That produces:

- A single unbounded project accumulating every lead task ever created, across all leads.
- Lead tasks appearing on a project board where they have no context.
- A `getOrCreateSalesProject` call on **every** task-sheet init, purely to supply a default.
- A structural lie: `tasks.project_id` claims a task belongs to a project when the meaningful
  relationship is `tasks.lead_id`.

`tasks.lead_id` already exists — FK to `leads` with `ON DELETE SET NULL`, and a partial index
`idx_tasks_lead` (`packages/db/src/schema.ts:469`, `524-525`, `536-539`). The anchor is already
there; it's just not authoritative.

## Fix

Make `tasks.project_id` nullable (**D8**). A lead task belongs to its lead and to no project.

**Explicitly not doing (D9):** transferring lead tasks to the client's project on conversion. Jason:
*"let's keep tasks on the lead and don't transfer anything."* Lead tasks stay lead-anchored
permanently.

**Explicitly not doing (D11):** predefined task presets. Free text only.

### Why this makes D12 safe

Client task visibility is deferred, and this section is what makes that deferral safe rather than
risky. `apps/client/lib/data/tasks.ts:58` selects tasks by `eq(tasks.projectId, projectId)`. **A
`NULL` `project_id` can never satisfy an equality predicate**, so lead tasks are structurally
invisible to the client portal — not by policy, but by the shape of the data.

That is a genuine guarantee, and it is worth stating plainly in code comments so nobody later
"fixes" the null handling and quietly opens the door.

---

## Schema

### The column

In `packages/db/src/schema.ts`, `tasks.projectId` (line 468):

```ts
// Before
projectId: uuid('project_id').notNull(),

// After
/**
 * NULL for lead-anchored tasks — they belong to a lead (see leadId), not a
 * project. See PRD 005 D8.
 *
 * SECURITY: the client portal selects tasks by equality on this column
 * (apps/client/lib/data/tasks.ts). NULL can never match an equality
 * predicate, so lead tasks are structurally invisible to portal users. Do not
 * "fix" that with a null-tolerant filter without revisiting PRD 005 D12.
 */
projectId: uuid('project_id'),
```

The FK stays `ON DELETE CASCADE` — it simply no longer fires for null rows.

### Integrity constraint

A task must be anchored to exactly one of the two:

```ts
check(
  'tasks_anchor_present',
  sql`CHECK (project_id IS NOT NULL OR lead_id IS NOT NULL)`
),
```

Without this, nullable `project_id` permits an orphan task reachable from nowhere. **Audit for
existing violations before adding the constraint** — a `lead_id`-only task can't exist yet
(`project_id` is currently `NOT NULL`), so this should be vacuously satisfied, but verify:

```sql
SELECT count(*) FROM tasks WHERE project_id IS NULL AND lead_id IS NULL;
```

Expect `0`. A non-zero result means the migration will fail — resolve those rows first.

> Deliberately **not** a mutual exclusion. A task with both set is legal: that's a project task that
> also references a lead, which the current data model already permits and which nothing here needs
> to forbid.

### Index review

**Three** indexes reference `project_id`: `idx_tasks_project`, `idx_tasks_project_archived`, and
`idx_tasks_project_status_rank`. Under Postgres, B-tree indexes do store NULLs, so all three remain
valid — but rows with a null `project_id` will never be *retrieved* through them. That's correct:
those rows are found via `idx_tasks_lead`.

No index changes required. Confirm the generated migration doesn't drop or rebuild them
unnecessarily.

### The time-log CHECK — read this before touching anything

`time_log_tasks` carries a database-level constraint (`packages/db/src/schema.ts:924-927`):

```ts
check(
  'time_log_task_matches_project',
  sql`CHECK (time_log_task_matches_project(time_log_id, task_id))`
),
```

**The function body is not in this repository.** It predates the Drizzle baseline capture and exists
only in the live database — `grep -rn "time_log_task_matches_project" packages/db/drizzle/migrations/*.sql`
returns nothing. Before generating any migration:

```sql
\df+ time_log_task_matches_project
-- or
SELECT prosrc FROM pg_proc WHERE proname = 'time_log_task_matches_project';
```

**Read the body and record it in [PROGRESS.md](PROGRESS.md).** If it dereferences
`tasks.project_id` without a null guard, it may return `NULL` (not `false`) for a lead task —
and a `CHECK` constraint **passes** on `NULL`. That would silently permit exactly the linkage D10
forbids.

Per **D10**, lead tasks cannot be time-logged, so the correct outcome is that no time log ever
references one. Enforce that in the application layer (below) rather than by modifying a database
function whose behavior you'd be inferring.

### Migration

From `packages/db/`:

```bash
npm run db:generate -- --name tasks_nullable_project
```

Expected: `ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL` plus the new CHECK. Review
before applying. If Drizzle proposes dropping and recreating indexes, investigate rather than
accepting.

---

## Application changes

### Task creation from a lead

`apps/internal/app/(dashboard)/leads/_actions/create-lead-task.ts`:

- Drop the `getOrCreateSalesProject` call entirely.
- Insert with `projectId: null`, `leadId` set.
- `resolveNextTaskRank(projectId, 'ON_DECK')` currently takes a project id. Lead tasks need a rank
  scoped to the **lead**, not a project. Add a sibling that ranks within `leadId`, or extend the
  existing helper to accept a discriminated anchor. Do not pass `null` into the project-scoped
  version and hope.

### Sheet init

With no default project needed, `salesProjectId` disappears from the task payload:

- `apps/internal/lib/sheets/init/payloads.ts:74` — remove the field.
- `apps/internal/lib/sheets/init/resolvers.ts:276-286` — remove from the `Promise.all` and `base`.
- `apps/internal/lib/sheets/wrappers/task-sheet-wrapper.tsx:50` — `defaultProjectId` becomes
  `leadId ? null : (data.task?.project_id ?? null)`.

Once this lands, `apps/internal/lib/leads/sales-project.ts` (created in §01) has no callers.
**Delete it**, and delete `apps/internal/scripts/dedupe-sales-project.ts` along with it — the
phantom-project problem ceases to exist. §01 was explicitly written as a deletable stopgap (W1).

> **Ordering prerequisite (W7):** confirm the dedupe script has already been **run in production**
> as part of §01 before deleting it here. Deleting it first would strand any remaining phantom
> projects with no tool left to clean them up. PROGRESS records the §01 run; check it.

### Archived lead tasks (D18)

Project archive routes are project-scoped (`/projects/[clientSlug]/[projectSlug]/archive`), and a
lead task has no project — so archiving one would make it disappear from the UI entirely.

The lead sheet's Tasks section (`LeadTasksSection`) must render archived lead tasks in a separate
grouping, collapsed by default, below the active ones. `listTasksForLead`
(`apps/internal/lib/queries/tasks/basic.ts:65`) currently filters `isNull(tasks.deletedAt)`; extend
it (or add a sibling) to return archived rows so the section can group them. **No project archive
view changes.** See C11.

**The restore affordance is required, not optional (PW6 — audit finding).** C11's whole rationale is
that archiving must not be an irreversible disappearance, so each archived row needs a restore
control in the grouping. Reuse the existing task restore action rather than adding a lead-specific
one — the task is already soft-deleted in the normal way; only its surface is different.

### Task sheet

When `leadId` is set and `projectId` is null:

- The project selector renders a non-interactive "Lead task" indicator instead of a project picker.
  Reassigning a lead task to a project is out of scope here.
- **Time-logging UI is hidden** (D10) — not disabled-with-tooltip, hidden. There is no valid target.
- Everything else — assignees, due date, description, comments, attachments — works unchanged.

### Time logging guard

Server-side, in the time-log creation path (`apps/internal/app/api/tasks/[taskId]/time-logs/`),
reject any attempt to log time against a task whose `project_id` is null, with a clear message.
Hiding the UI is not a guard; the API is.

### Board and list queries

Every query filtering `tasks` by `projectId` needs review for accidental inclusion or exclusion:

```bash
grep -rn "tasks.projectId\|eq(tasks.projectId" apps/internal/lib --include="*.ts"
```

- **Project boards** — must exclude null-project tasks. Equality already does this; confirm no
  `OR isNull(...)` sneaks in.
- **My Tasks** (`/api/my-tasks`) — assignee-scoped, not project-scoped. Lead tasks **should** appear
  here. Verify any project join is a `LEFT JOIN`; an inner join silently drops them.
- **Activity / archive** — same `LEFT JOIN` check.

`LEFT JOIN` versus inner join is the single highest-risk detail in this section. An inner join on
`projects` makes lead tasks vanish from surfaces where they belong, with no error.

> **Good news from the audit (I1):** the main My Tasks path already uses
> `leftJoin(projects, …)` / `leftJoin(clients, …)` (`apps/internal/lib/queries/tasks/summaries.ts:97-98`),
> so the headline risk is largely pre-mitigated. Verify the remaining call sites, but expect fewer
> corrections than this section's warning implies.

### The type ripple (W15 — audit finding)

`taskFields` selects `projectId` (`apps/internal/lib/queries/tasks/common.ts:7`), so making the
column nullable turns `SelectTask['projectId']` into `string | null` for **every** consumer of that
shared selection — not just the queries you intended to change.

This is where the compiler will actually surface the change, and it is a feature, not a nuisance:
work through the resulting errors rather than casting them away. Each one is a real call site that
now has to decide what a project-less task means.

**Do not** add a non-null assertion or `?? ''` to silence them. If a call site genuinely only ever
handles project tasks, narrow it explicitly (filter on `projectId !== null`) so the intent is
readable.

Note `tasksRelations.project` is `one(projects, …)` (`packages/db/src/relations.ts:142-145`) and
needs no change — Drizzle handles a nullable FK on the `one` side.

---

## Architecture notes

- **C6 — Null-as-invisibility is a real guarantee, and fragile in the way all implicit guarantees
  are.** It holds because SQL equality never matches NULL. Document it at the column (done above)
  and in `apps/client/lib/data/tasks.ts` so a future null-tolerant "fix" is an obvious red flag.
- **C7 — The CHECK function is unknown code.** Read it before assuming D10 is enforced by the
  database. `CHECK` passing on `NULL` is the specific trap.
- **W6 — Rank scoping changes meaning.** Ranks are currently unique within a project+status. For
  lead tasks the scope becomes lead+status. Don't reuse the project helper with a null argument.
- **W7 — §01's artifacts are meant to die here, but only after the script has run.** Deleting
  `sales-project.ts` and the dedupe script is part of this section, not cleanup debt — provided §01's
  production run is confirmed in PROGRESS first.
- **C11 — Archived lead tasks have nowhere else to live.** The lead sheet is their only home; without
  the archived grouping, archiving a lead task removes it from the UI permanently.

---

## Acceptance criteria

**Schema**
- [ ] Pre-flight audit run: `SELECT count(*) FROM tasks WHERE project_id IS NULL AND lead_id IS NULL`
      returns `0`, recorded in PROGRESS.md.
- [ ] `time_log_task_matches_project` function body read from the database and recorded in
      PROGRESS.md.
- [ ] `tasks.project_id` is nullable, with the security comment about portal invisibility.
- [ ] `tasks_anchor_present` CHECK added and rejects a task with neither anchor.
- [ ] Migration generated via `npm run db:generate -- --name tasks_nullable_project`, reviewed, and
      applied cleanly.
- [ ] No RLS statements in the migration.

**Creation**
- [ ] `create-lead-task.ts` no longer calls `getOrCreateSalesProject`; inserts `projectId: null`.
- [ ] Lead-task rank is scoped to the lead, via a lead-aware helper — not the project helper with a
      null argument.
- [ ] `salesProjectId` removed from `payloads.ts`, `resolvers.ts`, and `task-sheet-wrapper.tsx`.
- [ ] **§01's production dedupe run confirmed in PROGRESS** *before* the next two items (W7).
- [ ] `apps/internal/lib/leads/sales-project.ts` deleted.
- [ ] `apps/internal/scripts/dedupe-sales-project.ts` deleted.

**Behavior**
- [ ] Creating a task from the lead sheet produces a task with `project_id IS NULL` and the correct
      `lead_id`.
- [ ] That task appears in the lead sheet's Tasks section.
- [ ] That task does **not** appear on any project board.
- [ ] That task **does** appear in My Tasks when assigned to the current user.
- [ ] Task sheet shows a "Lead task" indicator in place of the project selector.
- [ ] Time-logging UI is hidden for a lead task.
- [ ] A direct API attempt to log time against a lead task is rejected server-side with a clear
      error.
- [ ] **Archiving a lead task keeps it visible in the lead sheet's Tasks section under an archived
      grouping** (D18), and it appears in **no** project archive view.
- [ ] Each archived row has a **restore control** that returns it to the active grouping, reusing
      the existing task restore action (PW6).
- [ ] `SelectTask['projectId']` type ripple worked through **without** non-null assertions or
      `?? ''` — narrowing is explicit where a call site only handles project tasks (W15).
- [ ] Existing project tasks are entirely unaffected — boards, ranks, and time logs unchanged.

**Portal (regression — must NOT change)**
- [ ] `apps/client/lib/data/tasks.ts` is **not modified** by this section.
- [ ] A client-portal user's project page shows exactly the tasks it showed before.
- [ ] No lead task is reachable from any client-portal surface.
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root.

---

## Files

**Modified**
- `packages/db/src/schema.ts` — nullable column, CHECK, comments
- `apps/internal/app/(dashboard)/leads/_actions/create-lead-task.ts`
- `apps/internal/app/(dashboard)/projects/actions/task-rank.ts` — lead-scoped rank
- `apps/internal/lib/queries/tasks/basic.ts` — `listTasksForLead` returns archived rows (D18)
- `apps/internal/app/(dashboard)/leads/_components/lead-sheet/lead-tasks-section.tsx` — archived
  grouping (D18)
- `apps/internal/lib/sheets/init/payloads.ts`
- `apps/internal/lib/sheets/init/resolvers.ts`
- `apps/internal/lib/sheets/wrappers/task-sheet-wrapper.tsx`
- Task sheet components — project selector + time-log visibility
- `apps/internal/app/api/tasks/[taskId]/time-logs/route.ts` — server guard
- Any board/list query needing a `LEFT JOIN` correction

**Deleted**
- `apps/internal/lib/leads/sales-project.ts` *(created in §01)*
- `apps/internal/scripts/dedupe-sales-project.ts`

**Created**
- `packages/db/drizzle/migrations/00XX_tasks_nullable_project.sql` *(generated)*

**Must NOT be modified**
- `apps/client/lib/data/tasks.ts`
