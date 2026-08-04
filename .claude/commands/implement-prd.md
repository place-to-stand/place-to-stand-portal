Implement the specified PRD. If a specific section is given, implement just that section. Otherwise, work through the **entire** PRD's recommended implementation sequence — every section, every acceptance criterion — without stopping early.

**This command has 4 phases. Execute them IN ORDER. Output the completion table after each phase and after each section within Phase 2.**

**Hard requirement:** by the end, every section file in the PRD directory must either (a) be fully implemented with `npm run type-check` + `npm run lint` passing (run from the repo root — Turbo fans out to the touched workspaces), or (b) have an explicit "Deferred — {reason}" annotation in PROGRESS.md explaining why it couldn't be implemented in this session. No silent skips.

## Phase 1 — Before writing any code

1. Read README.md for the implementation order, dependency diagram, and recommended sequence.
2. Read ARCHITECTURE-REVIEW.md for all C/W/I findings (and any post-impl UF findings).
3. Read PROGRESS.md — count items: `TOTAL=$(grep -cE '^- \[[ x]\]' PROGRESS.md)`, `DONE=$(grep -cE '^- \[x\]' PROGRESS.md)`, `TODO=$(grep -cE '^- \[ \]' PROGRESS.md)`.
4. If pre-implementation items remain, do those first before any section work.
5. **Enumerate every section** the PRD contains. Print a table listing each section file, its dependencies, and its planned implementation order. This is the **implementation plan** — you will execute every row.

**Output the completion table:**
| Phase | Status | Output |
|-------|--------|--------|
| 1 | Done | All N sections enumerated: {01-name, 02-name, ...}. Pre-impl items remaining: {list or "none"}. |
| 2 | Pending | — |
| 3 | Pending | — |
| 4 | Pending | — |

## Phase 2 — Implement every section

**Iterate over every section in the recommended order. Do NOT stop after a "representative sample" or ask the user if they want to continue. The default is to drive the entire PRD through to landing.**

For each section file (`01-xxx.md`, `02-xxx.md`, ... `0N-xxx.md`):

### Before coding the section:
1. Read the full section file — understand the problem, decisions, implementation details, and acceptance criteria.
2. Read ALL existing files that will be modified (understand before changing).
3. Check for any C/W/I/UF codes referenced in the section and plan to address them inline.

### During coding:
- Follow all patterns and conventions in CLAUDE.md and AGENTS.md.
- Match existing code style in adjacent files, in the correct workspace (`apps/internal`, `apps/client`, `packages/db`, `packages/github`).
- Schema changes: edit `packages/db/src/schema.ts` + `relations.ts`, generate with `npm run db:generate -- --name <label>` from `packages/db/`, review the SQL, apply with `npm run db:migrate`. Keep the snake-case `DbClient`/`DbProject`/`DbUser` twins in `apps/internal/lib/types.ts` in sync.
- All access control is application-layer (`lib/auth/permissions.ts`) — never RLS. New mutations log activity events where the PRD says so.
- Include only what's specified — don't add features, refactor, or "improve" surrounding code.
- The acceptance criteria are the definition of done.

### After coding each section:
1. Run `npm run type-check` from the repo root — must pass (zero errors).
2. Run `npm run lint` from the repo root — must pass.
3. Update PROGRESS.md: every acceptance criterion in that section's block gets `[x]` if implemented OR a `<!-- deferred: {reason} -->` annotation if blocked. No silent `[ ]`.
4. Update TEST-PLAN.md — check off any test items you can verify programmatically (e.g., `npm run type-check` passes covers TR.12).

**Manual-step convention:** If an acceptance criterion legitimately can't be done by code-writing alone (e.g., a `drizzle-kit generate` column-rename needs an interactive TTY, a Supabase Storage bucket needs manual creation, prod env vars need to be set in Vercel for both apps), leave the item `[ ]` but append `<!-- MANUAL STEP for the user: {what to do, where} -->`. Do NOT mark it as deferred — the work is real, just not for the model.

### After every section commits to PROGRESS:
Output the section completion table:

| Section | Status | type-check | lint | PROGRESS updated | TEST-PLAN updated |
|---------|--------|-----------|------|-----------------|-------------------|
| 01 | Done | pass | pass | yes | yes |
| 02 | Done / Deferred (reason) | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... |

### Anti-patterns to avoid

- ❌ **Stopping after a few sections** and asking the user "do you want me to continue?". The user invoked `/implement-prd` — that's the answer. Drive every section.
- ❌ **Skipping ahead to "the demo-critical sections"** — every section is in the PRD because it earned its place there during scope/audit/consistency-check. Implement all of them.
- ❌ **Marking items `[x]` without writing the code** — only check off what you actually shipped. If you can't ship it, write `<!-- deferred: ... -->` or `<!-- MANUAL STEP ... -->`.
- ❌ **Working through sections out of dependency order** — if §03 depends on §01, §01 must be type-check-passing before §03 starts.
- ❌ **Leaving a section silent if it's hard** — implement, defer with reason, or ask a clarifying AskUserQuestion. Never just move on.

## Phase 3 — Exhaustiveness check + final verification

**Before declaring Phase 3 done:**

1. Run `npm run type-check` AND `npm run lint` one last time from the repo root on the full diff — both must pass.
2. PROGRESS.md exhaustiveness:
   - `UNTAGGED=$(grep -cE '^- \[ \] [^<]*$' PROGRESS.md)` — unchecked items with NO `<!-- ... -->` annotation
   - If `UNTAGGED > 0`, Phase 3 is not done — go back and either implement those items, mark them `<!-- deferred: {reason} -->`, or mark them `<!-- MANUAL STEP for the user: ... -->`.
3. Print a summary table:
   - Total acceptance items in PROGRESS.md
   - How many checked (`[x]`)
   - How many manual-step (`[ ] <!-- MANUAL STEP ...`)
   - How many deferred (`[ ] <!-- deferred: ...`)
   - **Untagged (must be 0)**
4. List the files created vs modified across all sections.
5. List the manual steps the user needs to do (migrations in staging/prod, Vercel dashboard, env vars for both Vercel projects, Supabase buckets, etc.) as a checklist at the end of the chat output.

## Phase 4 — Commit and push

**Only after Phase 3 passes (type-check ✓, lint ✓, untagged = 0). Never commit a failing tree.**

1. If on `main`, create a branch first (`prd-NNN-{slug}` matching the PRD directory name). Otherwise stay on the current PRD branch.
2. `git add -A` — the commit includes the code, migrations, AND the updated PROGRESS.md / TEST-PLAN.md (the docs are the session record; they land together).
3. Commit with a message that summarizes the implementation per section (one line each is fine), notes the migrations created + that they were applied locally (prod apply happens at deploy), and ends with the Co-Authored-By trailer from CLAUDE.md/harness conventions.
4. `git push` (set upstream with `-u origin <branch>` if the branch has no remote yet).
5. Do NOT open a PR here — that's `/submit-prd`'s job. If a PR already exists for the branch, the push updates it; say so.
6. Report the commit hash + branch + push result in the final table.

**Output the final completion table:**
| Phase | Status | Output |
|-------|--------|--------|
| 1 | Done | ... |
| 2 | Done | All N sections processed: {N done, N deferred, N manual-step-required} |
| 3 | Done | type-check ✓, lint ✓, PROGRESS untagged = 0, manual steps for user: {N items} |
| 4 | Done | Committed {hash} on {branch}, pushed ✓ {(updates PR #N | no PR yet — run /submit-prd)} |

$ARGUMENTS
