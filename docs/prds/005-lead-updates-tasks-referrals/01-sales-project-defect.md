# 01 — Sales Project Defect

**PRD:** [005](README.md) · **Complexity:** Low · **Schema:** No · **App:** `apps/internal`
**Depends on:** Nothing · **Blocks:** [04-lead-task-placement.md](04-lead-task-placement.md)
**Decisions:** [D7](README.md#key-decisions)

> **Ship this on its own branch, ahead of the rest of the PRD.** It fixes a live bug and is
> roughly ten lines. Do not let it wait behind sections 02–05.

---

## Problem

Kris flagged that lead tasks are *"adding to a hardcoded project that actually no longer exists."*
The reality is worse: the project doesn't merely not exist — **it regenerates, and after cleanup it
crashes the task sheet.**

There are two divergent implementations of the same function:

| Site | Slug / Name | Conflict-safe? |
| --- | --- | --- |
| [`apps/internal/app/(dashboard)/leads/_actions/create-lead-task.ts:39`](../../../apps/internal/app/(dashboard)/leads/_actions/create-lead-task.ts) | `sales` / `Sales` ✅ | **Yes** — `onConflictDoNothing({ target: projects.slug })` plus a re-select for the race loser |
| [`apps/internal/lib/sheets/init/resolvers.ts:235`](../../../apps/internal/lib/sheets/init/resolvers.ts) | `sales-strategy` / `Sales Strategy` ❌ | **No** — bare `db.insert(...)` |

### Why this is a live crash, not just untidiness

1. `resolveTaskInit` calls `getOrCreateSalesProject(user.id)` inside a `Promise.all` on
   **every task-sheet init** (`resolvers.ts:276-280`) — not only when a task is created from a lead.
   Any task sheet opened on a route the `SheetHost` covers hits this path.
2. `idx_projects_slug` is `UNIQUE` on `slug WHERE slug IS NOT NULL` — **it does not consider
   `deleted_at`** (`packages/db/src/schema.ts:433-435`).
3. The resolver's lookup filters `isNull(projects.deletedAt)`.

So once [`apps/internal/scripts/dedupe-sales-project.ts`](../../../apps/internal/scripts/dedupe-sales-project.ts)
soft-deletes the phantom project, the resolver's `SELECT` no longer finds it, falls through to the
bare `INSERT`, and hits a unique violation on the still-live index. `GET /api/sheets/init` throws.

**Running the cleanup script is what arms the bug.** Before cleanup the resolver quietly
re-creates a phantom `Sales Strategy` project that shadows the real `Sales` one; after cleanup it
500s. Neither state is acceptable.

### Secondary defect

`create-lead-task.ts` and `resolvers.ts` disagree about which project lead tasks belong to. A task
created through the lead sheet lands in `Sales`, while the task sheet's `defaultProjectId` points at
`Sales Strategy` ([`task-sheet-wrapper.tsx:50`](../../../apps/internal/lib/sheets/wrappers/task-sheet-wrapper.tsx)).
The same user action produces different results depending on entry point.

---

## Fix

Delete the copy in `resolvers.ts` entirely. Have the task-sheet init resolve the Sales project
through the **one** correct implementation, exported from its existing home.

This is deliberately a minimal, surgical fix. Section 04 removes the concept of a default lead-task
project altogether (D8) — but 04 is a schema change behind a migration, and this bug should not wait
for it.

### Step 1 — Export the good implementation

In `apps/internal/app/(dashboard)/leads/_actions/create-lead-task.ts`, the function is currently
module-private. Because the file is `'use server'`, **every export must be an async server action** —
exporting a plain helper from it is a build error.

Move the function to a non-`'use server'` module instead:

```ts
// apps/internal/lib/leads/sales-project.ts  (NEW)
import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'

const SALES_PROJECT_NAME = 'Sales'
const SALES_PROJECT_SLUG = 'sales'

/**
 * Resolve the internal "Sales" project — the default home for lead tasks.
 *
 * The existing project is always preferred. A project is created only as a
 * guarded fallback when none exists; `onConflictDoNothing` on the unique slug
 * index keeps concurrent callers from racing a duplicate into existence.
 *
 * This is the ONLY implementation. A second, divergent copy previously lived in
 * lib/sheets/init/resolvers.ts using the slug `sales-strategy`; it recreated a
 * phantom project on every task-sheet init and threw a unique violation once the
 * phantom had been soft-deleted. See PRD 005 §01.
 */
export async function getOrCreateSalesProject(userId: string): Promise<string> {
  // ... body moved verbatim from create-lead-task.ts:39-91
}
```

Then in `create-lead-task.ts`, delete the local definition and import it.

### Step 2 — Point the resolver at it

In `apps/internal/lib/sheets/init/resolvers.ts`:

- Delete `SALES_PROJECT_SLUG`, `SALES_PROJECT_NAME`, and the local `getOrCreateSalesProject`
  (lines 228–271).
- Import from `@/lib/leads/sales-project`.
- Leave `resolveTaskInit` otherwise unchanged — the `Promise.all` call site keeps working.

### Step 3 — Verify no other copies exist

```bash
grep -rn "sales-strategy\|Sales Strategy" apps packages --include="*.ts" --include="*.tsx"
```

After this change the only surviving hits should be in `scripts/dedupe-sales-project.ts` (where the
strings are the cleanup target, and are correct) and in this PRD.

### Step 4 — Run the cleanup script

Now that nothing regenerates the phantom, the cleanup becomes permanent:

```bash
npx tsx scripts/dedupe-sales-project.ts
```

Run from `apps/internal` with `DATABASE_URL` set. It is idempotent. **Run it only after steps 1–3
are deployed** — running it against the old code arms the crash described above.

> Production runs read `apps/internal/.env.prod`, which exists only in the main checkout, not in
> worktrees.

---

## Architecture notes

- **W1 — This is a stopgap by design.** Section 04 (D8) makes `tasks.project_id` nullable and drops
  the notion of a default project for lead tasks, at which point `getOrCreateSalesProject` and the
  `salesProjectId` payload field both disappear. Keep the new module small and obviously deletable;
  don't build anything on top of it.
- **C1 — The real defect is a missing constraint, not a typo.** Two functions could diverge because
  nothing tied "where lead tasks live" to a single definition. The fix is the shared module, not the
  corrected slug.
- **C2 — Note the partial-index / soft-delete mismatch.** `idx_projects_slug` ignores `deleted_at`
  while every application query filters on it. Any future "find or create by slug" against `projects`
  has the same trap. Worth remembering; not worth fixing here.

---

## Acceptance criteria

- [ ] `apps/internal/lib/leads/sales-project.ts` exists, is marked `import 'server-only'`, and
      exports `getOrCreateSalesProject` with the conflict-safe body.
- [ ] `create-lead-task.ts` imports it; its local copy is deleted.
- [ ] `resolvers.ts` imports it; lines 228–271 (constants + local copy) are deleted.
- [ ] `grep -rn "sales-strategy\|Sales Strategy" apps packages --include="*.ts" --include="*.tsx"`
      returns hits only in `scripts/dedupe-sales-project.ts`.
- [ ] Opening a task sheet from a non-canonical route (which routes through
      `GET /api/sheets/init`) returns 200 and does not create any project.
- [ ] Creating a task from the lead sheet and creating one from the task sheet with `?lead=<id>`
      both land in the **same** project.
- [ ] With a soft-deleted `sales-strategy` project present in the database, opening a task sheet
      does **not** throw a unique-violation error. *(This is the regression test for the crash.)*
- [ ] `npx tsx scripts/dedupe-sales-project.ts` has been run and, on a second run, reports
      "No bogus … projects found."
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root.

---

## Files

**Created**
- `apps/internal/lib/leads/sales-project.ts`

**Modified**
- `apps/internal/app/(dashboard)/leads/_actions/create-lead-task.ts` — remove local copy, import
- `apps/internal/lib/sheets/init/resolvers.ts` — remove local copy + constants, import

**Unchanged but relevant**
- `apps/internal/scripts/dedupe-sales-project.ts` — run after deploy
- `apps/internal/lib/sheets/wrappers/task-sheet-wrapper.tsx:50` — consumes `salesProjectId`;
  behavior corrects itself once both sides agree
