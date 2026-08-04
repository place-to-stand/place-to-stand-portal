Audit the PRD in the specified directory as two roles, then resolve findings interactively.

**This command has 3 steps. Execute them IN ORDER. After each step, output the completion table. Do NOT proceed until the current step is Done.**

## Step 1 — Principal Engineer (Architecture Review)

Read every file in the PRD directory AND the actual codebase files they reference. This is a Turborepo monorepo — verify against the correct workspace (`apps/internal`, `apps/client`, `packages/db`, `packages/github`):

- **Schema** — do all referenced fields, tables, enums actually exist in `packages/db/src/schema.ts`? Any missing indexes? Relations declared in `packages/db/src/relations.ts`? Remember the `DbClient`/`DbProject`/`DbUser` snake-case twins in `apps/internal/lib/types.ts` — schema changes must land in both.
- **Queries** — do the join paths work? Are return shapes correct for the components consuming them? Do they follow the queries-layer (`lib/queries/`) vs data-layer (`lib/data/`) split?
- **Component placement** — right app AND right directories? Consistent with project conventions?
- **Server actions** — do signatures match PRD assumptions? Will they work from the proposed call sites (different route segments)?
- **Access control** — does every new query/action enforce permissions in the application layer (`lib/auth/permissions.ts`)? Remember: NO Row Level Security in this project — flag any PRD text that assumes RLS.
- **State management** — DnD conflicts, shared vs per-field transitions, optimistic state feasibility
- **Missing items** — dead revalidation paths, missing Suspense boundaries, missing type definitions, missing Zod schema updates, uninstalled packages, race conditions, missing activity-log events, missing soft-delete (`deletedAt`) filters
- **Revalidation** — do all server actions invalidate the correct pages (including dynamic route segments)?

Report findings as **C# (Critical)** — blocks implementation, **W# (Warning)** — risks, or **I# (Info)** — suggestions. Include file paths and line numbers.

**Output the completion table:**
| Step | Status | Output |
|------|--------|--------|
| 1 | Done | {N critical}, {N warnings}, {N info} findings |
| 2-3 | Pending | — |

## Step 2 — Product Manager (Product-Market Fit)

Read the agency's website at https://placetostandagency.com/ to understand the brand, services, and client base. Then evaluate:

- Does each feature match how the agency actually works day-to-day — managing clients, projects, tasks, time logs, leads, and invoices?
- Are the UX decisions right for the primary users? There are two: the **agency admin** (running the internal portal all day, bouncing between project boards, time logging, and billing) and the **client** (checking in on the client portal occasionally — it must be self-explanatory and polished, since it IS the agency's client experience).
- Are deferred items correctly prioritized vs. what would deliver the most value?
- Any gaps that would frustrate daily use (empty states, missing defaults, unclear labels)?
- Does the quality bar match the product's ambitions? The client portal is client-facing — anything a client can see reflects directly on the agency's brand.

Report findings as **P# (Product Critical)**, **PW# (Product Warning)**, or **PI# (Product Info)**.

**Output the completion table:**
| Step | Status | Output |
|------|--------|--------|
| 1 | Done | ... |
| 2 | Done | {N product critical}, {N product warnings}, {N product info} findings |
| 3 | Pending | — |

## Step 3 — Ask questions, then incorporate

**Present ALL findings from Steps 1 and 2 to the user.** Then:

1. **Use AskUserQuestion** for every finding that requires a decision (e.g., "should this feature appear in the client portal too?", "should the board support inline editing?"). Don't silently make choices.
2. After all questions are answered, create/update ARCHITECTURE-REVIEW.md with all findings and resolutions.
3. Update section files to incorporate Critical and Warning items inline (pseudocode fixes, notes for implementer).
4. Update PROGRESS.md pre-implementation checklist with any new items discovered.
5. Update TEST-PLAN.md if new test items are needed.

**Output the final completion table:**
| Step | Status | Output |
|------|--------|--------|
| 1 | Done | ... |
| 2 | Done | ... |
| 3 | Done | {N decisions resolved}, {N files updated} |

$ARGUMENTS
