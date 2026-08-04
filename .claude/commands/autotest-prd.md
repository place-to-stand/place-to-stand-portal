Run automated browser tests against the TEST-PLAN.md for the specified PRD, fix failures iteratively, and produce a manual test summary.

## Browser Automation — `agent-browser` CLI

All browser interaction MUST use the `agent-browser` CLI via the Bash tool. NEVER use Playwright MCP tools (`mcp__plugin_playwright_*`) or browser MCP tools (`mcp__browser__*`).

**Two apps, two ports.** This monorepo serves the internal admin portal at `http://localhost:3000` and the client portal at `http://localhost:3001`. `npm run dev` from the repo root starts both via Turbo. Each TEST-PLAN item belongs to one app — use the right base URL, and use a separate session per app (`--session autotest-internal`, `--session autotest-client`) so the two sign-ins don't clobber each other.

**Session pattern** — reuse the same `--session` for all commands against an app so browser state persists across calls:

```bash
# Navigate
agent-browser --session autotest-internal open http://localhost:3000/some/page

# Wait for page load
agent-browser --session autotest-internal wait --load networkidle

# Get interactive elements (returns @ref IDs for clicking/filling)
agent-browser --session autotest-internal snapshot -i

# Click, fill, type by @ref
agent-browser --session autotest-internal click @e5
agent-browser --session autotest-internal fill @e3 "some text"
agent-browser --session autotest-internal press Enter

# Get page info
agent-browser --session autotest-internal get text @e1
agent-browser --session autotest-internal get url
agent-browser --session autotest-internal get title

# Screenshot (for visual verification)
agent-browser --session autotest-internal screenshot

# Chain commands in one call for speed
agent-browser --session autotest-internal open http://localhost:3000/page && agent-browser --session autotest-internal wait --load networkidle && agent-browser --session autotest-internal snapshot -i
```

**Login flows** (run once per app at start of Phase 2):
```bash
# Internal admin portal
agent-browser --session autotest-internal open http://localhost:3000/sign-in && agent-browser --session autotest-internal wait --load networkidle && agent-browser --session autotest-internal snapshot -i
# Client portal (when the PRD touches apps/client)
agent-browser --session autotest-client open http://localhost:3001/sign-in && agent-browser --session autotest-client wait --load networkidle && agent-browser --session autotest-client snapshot -i
# Then fill email, password fields and click sign in using @refs from snapshot
```

**Key rules:**
- Always `snapshot -i` after navigation to get element refs
- Use `wait --load networkidle` after navigating to a new page
- Chain related commands with `&&` to reduce round-trips
- Use the same `--session` on EVERY command against an app to maintain browser state
- Test permission scoping from both sides: admin sees everything; a CLIENT-role user must only see data for clients they're a member of (`client_members`)


**This command has 3 phases. Execute them IN ORDER. Output the completion table after each phase.**


## Phase 1 — Audit PROGRESS.md

1. Read PROGRESS.md in the PRD directory
2. Scan the actual codebase to determine which items are truly complete vs. still pending:
   - For each checkbox item, grep/read the relevant files to verify the work exists
   - Check off items that are done but not yet marked
   - Uncheck items marked done but where the code doesn't match
3. Write the updated PROGRESS.md
4. Report a short summary: "X of Y items complete, Z corrections made"

**Output the completion table:**
| Phase | Status | Output |
|-------|--------|--------|
| 1 | Done | {X of Y complete, Z corrections} |
| 2 | Pending | — |
| 3 | Pending | — |

## Phase 2 — Automated browser testing

**Hard requirement: every test item in TEST-PLAN.md gets either `[x] <!-- auto-tested -->` OR `[ ] <!-- manual: see MANUAL-TEST-PLAN Section B -->` by the end of this phase. No item may be left as a silent `[ ]` without an annotation. Phase 2 only completes when `grep -cE '^- \[ \]' TEST-PLAN.md | grep -v 'manual:'` returns 0 (i.e., every unchecked item has a manual-tag explaining why).**

### The bar for "auto-tested"

An item only earns `[x] <!-- auto-tested -->` if there is a specific `agent-browser` invocation, `curl`, `psql`/`postgres.js` query, source-file grep, or `npm run` command **in this session's bash history** whose output answered the test's assertion. "Inferred from the section heading" or "implied by another nearby test" is NOT enough — those become `manual:` tags.

When tempted to bulk-tag a whole section by heuristic (e.g. a Python script that walks headings and stamps all items below), **stop**. That's the failure mode this command was rewritten to prevent. Stamp items one at a time as you exercise them, or in tight clusters (3-8) that share a single browser flow you literally ran. The diff in TEST-PLAN.md should be hand-attributable to specific tool calls.

### The "I would have flipped state" rule

Before tagging an item as Section B with the reason "needs a Paid/overdue/archived/cross-client/empty fixture," you must first ask: **can I produce that state by editing the local DB?** If yes, do it — UPDATE/INSERT/DELETE on the local Supabase is free. Section B is reserved for things you cannot produce locally:

- Real third-party API responses (Stripe, Resend, GitHub App webhooks, PostHog, anything that lives off the local stack)
- Real time-based behavior beyond what `created_at`/`due_date` adjustments can simulate
- Real device input (touch, gestures, system permission prompts)
- Real race conditions across separate browser sessions

Anything that boils down to "I needed a row in state X" is **not** Section B. Walk an existing row through every relevant status via SQL (`UPDATE tasks SET status='DONE'`, `UPDATE invoices SET status='PAID', paid_at=NOW()`, set `deleted_at` to test archive views), reload the page, observe the consequences. A single seeded task can validate the entire BACKLOG → ON_DECK → IN_PROGRESS → IN_REVIEW → DONE lifecycle in a few UPDATEs.

### Mandatory exhaustive pass

This phase is a **loop**, not a single sweep. Continue exercising items until both:

1. `grep -cE '^- \[ \][^<]*$' TEST-PLAN.md` is 0 (every line tagged)
2. You can defend every `<!-- auto-tested -->` tag by pointing at a specific tool call in this session

Steps:

1. Read TEST-PLAN.md in the PRD directory. Count total items: `TOTAL=$(grep -cE '^- \[ \]' TEST-PLAN.md)`.
2. Ensure the dev servers are running (`npm run dev` from the repo root starts both apps). If not, start them in the background and wait for both ports to be ready.
3. **Pre-categorize every item up-front** — go through the test plan and assign each item a category before starting any browser work:
   - **A** = Automatable via agent-browser, curl, or DB state manipulation (clicks, fills, URL checks, queries, conditional rendering, lifecycle walks, role-scoping checks via a second session signed in as a CLIENT user)
   - **B** = Not automatable — give a one-line reason. Legitimate Section B reasons (post the "I would have flipped state" rule):
     - Real external systems (Stripe checkout redirects, real email delivery via Resend, GitHub App install flows)
     - Production-only env state (Vercel dashboard provisioning, kill-switch env vars)
     - Race conditions / concurrent edits (two-tab, rapid clicks, network disconnect)
     - Visual / "feel" judgments where the assertion is subjective (drag-and-drop smoothness, color contrast)
     - Mobile gestures (real touch events vs. viewport-only)
     - Tests blocked by an unrelated environment issue (missing Postgres extension, missing webhook secret, etc.)

   Print this categorization as a table so the user can see your plan. **The plan must be aggressive about Section A** — items that look "manual" often become "auto" after one SQL flip.
4. **Seed the fixtures you'll need up front.** If the test plan references tasks in every lifecycle status, or both prepaid and net_30 clients, ensure you have or can produce one of each before starting. Cluster fixture setup at the top of the phase so you don't bounce between testing and seeding.
5. **Work in section order. Within a section, batch related items into a single browser flow** — e.g., open the create dialog ONCE and verify field defaults (T3.6), date default (T3.9), status default (T3.10) in one sequence. Don't navigate fresh for every test ID. Each browser flow should knock out 3-8 test items.
6. For each automated item:
   a. Use `agent-browser` (or curl, or `node -e` against the local DB) to navigate / interact / query
   b. Evaluate pass/fail from the tool output AND, where the test asserts persistence, a follow-up query against the local DB
   c. If a test **fails**:
      - Diagnose root cause (read the source file, check dev-server logs)
      - Implement a fix
      - Run `npm run type-check` AND `npm run lint` from the repo root
      - Re-test the same item + any items in the same browser flow that may have been affected
      - If still failing after 2 fix attempts, **change its category to Section B** with reason "needs manual review — autotest couldn't fix" and move on
   d. Update TEST-PLAN.md: `[ ] → [x]` and append `<!-- auto-tested -->` to the line — but only after the verifying tool call appears in your session log. No bulk-tagger shortcuts.
7. For each Section B item, leave the checkbox at `[ ]` and append `<!-- manual: see MANUAL-TEST-PLAN Section B -->`.
8. **Self-audit before declaring Phase 2 done.** This is the gate that catches lazy tags:
   - `CHECKED=$(grep -cE '^- \[x\]' TEST-PLAN.md)`
   - `UNCHECKED=$(grep -cE '^- \[ \]' TEST-PLAN.md)`
   - `UNTAGGED=$(grep -cE '^- \[ \] [^<]*$' TEST-PLAN.md)`
   - If `UNTAGGED > 0`, you are NOT done. Loop back to step 6.
   - **Then sample 5-10 random items tagged `auto-tested` and explicitly cite the tool call that verified each.** If you can't cite one, re-tag it `manual:` and add it to Section A.
   - **Then re-read every `manual:` tag and ask: "would a SQL flip or curl have made this testable?"** If yes, loop back and verify it.
   - Print the final counts: "Auto-tested: X. Manual-tagged: Y. Untagged: 0."
9. **Then** commit any fixes with a descriptive message. Don't commit until the self-audit passes.

**Anti-patterns — these are explicitly disallowed:**
- ❌ "I'll knock off ~64 representative tests and call it a day." Every item needs an explicit disposition.
- ❌ Bulk-tagging by section heading (e.g., a Python script that walks headings and stamps all `- [ ]` lines below them as `auto-tested`). Tags must be earned line-by-line.
- ❌ "Section B: needs Paid fixture." A Paid fixture is one UPDATE away. Run the UPDATE first.
- ❌ "Source-verified" as a shortcut for "I read the code but didn't run it." Source reading is fine for confirming a guard exists, but the test ALSO requires the runtime behavior to be exercised whenever a state can be reached without external systems.
- ❌ Marking items as auto-tested without actually exercising them (e.g., "T4.22-T4.25 all pass — inferred from prior runs"). Mark only what you literally exercised in THIS session.
- ❌ Stopping when the model "feels like enough has been covered." Completion is mechanical (the counts and the self-audit), not vibes-based.
- ❌ Leaving items silently `[ ]`. They MUST get either `[x] <!-- auto-tested -->` or `[ ] <!-- manual: ... -->`.

**Output the completion table:**
| Phase | Status | Output |
|-------|--------|--------|
| 1 | Done | ... |
| 2 | Done | {N auto-tested}, {N manual-tagged for Section B}, {N untagged — MUST be 0} |
| 3 | Pending | — |

## Phase 3 — Manual test plan document (MANDATORY FILE WRITE)

After all automated testing is complete, you MUST create a file named `MANUAL-TEST-PLAN.md` inside the PRD directory. This is not optional and not just chat output — the file must exist on disk and be committed alongside the autotest fixes. The manual test plan is what the user works through during workflow step 9 (manual testing + fine-tuning), so it has to survive across sessions.

**File path:** `docs/prds/0XX-name/MANUAL-TEST-PLAN.md`

**Required structure** (use this template — fill in the real content):

```markdown
# PRD-0XX Manual Test Plan

> Generated by `/autotest-prd` on YYYY-MM-DD.
> Companion to `TEST-PLAN.md` — items checked off there by automation are still listed here in **Section C** for human gut-check.

[1-2 sentence summary of the autotest run: how many items passed, any bugs found and fixed.]

## Test environment

- [Dev server URLs (internal :3000, client :3001), login credentials, seed data summary]
- [⚠️ Any env vars or external services that were NOT configured during automation — these gate Section B items]

---

## 🟥 Section A — Highest priority (failed/flaky/observed issues)

These need a hands-on look — they revealed real concerns during automation. Each item must include:
- A short label tying it back to the original test ID(s)
- What was observed
- A concrete repro or "decide whether X is acceptable"

- [ ] **A1. ...**
- [ ] **A2. ...**

## 🟧 Section B — Not automatable (require human/external context)

Group by category (Environment / external systems, Drag and drop, Visual / "feel" judgments, etc.). Every item must:
- Reference the original test ID
- Explain WHY it couldn't be automated
- Say specifically what to verify

### [Category]
- [ ] **B1. (TX.X) ...**
- [ ] **B2. (TX.X) ...**

## 🟩 Section C — Gut-check items (passed automation, eyeball for polish)

Everything that passed an automated assertion. Touch each one to confirm the feel is right. Group by PRD section so the user can work through it linearly.

### [PRD section name]
- [ ] **C1. (TX.X)** ...

---

## ✏️ Fixes applied during autotest

| # | Issue | File | Commit |
|---|-------|------|--------|
| F1 | [description] | [path] | [short SHA] |

---

## Summary counts

| Section | Count |
|---------|-------|
| A — High priority follow-ups | N |
| B — Not automatable | N |
| C — Gut-check (auto-pass) | N |
| **Total** | **N** |
```

**Rules:**
1. The file must be **written to disk** with the Write tool — chat output alone does not satisfy this step.
2. Use the user's local date in the "Generated by" line. If you don't know it, ask before writing.
3. Cross-reference every item back to its original `TX.X` / `EX` test ID from `TEST-PLAN.md` so the user can find it in the source plan.
4. Section A is the *most important* — anything that decisively failed, behaved oddly, or needs a product decision goes here, not buried in Section B.
5. After writing the file, commit it together with any autotest fixes (do NOT split into a separate commit).
6. Then echo a short text summary of the file path and section counts back to the user.

**Output the final completion table:**
| Phase | Status | Output |
|-------|--------|--------|
| 1 | Done | ... |
| 2 | Done | ... |
| 3 | Done | Wrote `docs/prds/0XX-name/MANUAL-TEST-PLAN.md` — {N section A}, {N section B}, {N section C} |

$ARGUMENTS
