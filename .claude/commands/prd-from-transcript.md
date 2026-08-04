I'm feeding you a Gemini summary and raw transcript from a stakeholder feedback session. Turn it into a complete, implementation-ready PRD that Claude Code can execute section by section.

**This command has 3 phases. Execute them IN ORDER. Output the completion table after each phase. Do NOT proceed to Phase 2 until Phase 1 is complete and the user has approved the structure.**

**Important context:**
- **Build this with me, not for me.** The scope is probably too big to generate all at once. Break it down granularly and iterate with me. Propose structure first, get my feedback, then write. I want to be involved in the decisions.
- **Split into small files** that manage the LLM context window. Each section file should be self-contained enough that an LLM can implement it by reading only that file plus the README (not the entire PRD). Files should link to each other, clearly listing dependencies.
- **Create a progress document and a manual test plan document** that get updated after each coding session.
- **Pull inspiration from the existing codebase** for patterns, conventions, and implementation approaches. Look at how similar features were built in this repo. This is a Turborepo monorepo — every file path in the PRD must be workspace-qualified (`apps/internal/...`, `apps/client/...`, `packages/db/...`), and every feature must state which app(s) it lives in.

## Phase 1 — Analysis & Structure (interactive)

0. **Archive the source material FIRST.** Save the raw transcript and the Gemini summary verbatim into `docs/prds/<nnn>-<slug>/source/` (e.g. `source/transcript.md`, `source/gemini-summary.md`) before doing anything else. The source must survive in the repo so any future "was X ever asked for?" question is answerable with grep — a pasted-in transcript that gets used once and discarded makes repeat-ask misses unauditable.
1. **Verify Gemini accuracy.** Review the summary against the raw transcript. Flag discrepancies: missing items, overstated features, personal conversation incorrectly included, deferred items listed as active work.
2. **Repeat-ask sweep.** Grep the previous 2–3 PRDs' `source/` transcripts (where present) and section files for asks that this transcript REPEATS. Treat the **surface as part of the ask's identity** — the same action requested on the project board and on the backlog view are two different requirements; never collapse a repeated ask into a prior decision without verifying the exact surface actually shipped (check the code, not the PRD checkbox). List every repeat ask prominently in the structure proposal, marked "repeat ask — Nth session".
3. **Scan the codebase.** Look at the latest PRD in docs/prds/ to understand format, numbering, and conventions (if docs/prds/ is empty, this is PRD 001 — use the structure defined in this command). Explore the existing codebase for infrastructure relevant to the discussed features (schemas in `packages/db/src/schema.ts`, queries in `apps/internal/lib/queries/`, data layer in `apps/internal/lib/data/`, components, server actions). Reference specific file paths.
4. **Propose structure.** Present a section breakdown table (file names, topics, estimated complexity) and get my approval before writing. I want to iterate on this.
5. **Ask me questions.** Use AskUserQuestion to resolve all ambiguities and conflicts before writing. Don't assume — ask. Cover things like: scope boundaries, which app owns the feature (internal vs client portal), UX behavior on click/hover/drag, which page owns the feature, default states, edge cases.

**Output the completion table:**
| Phase | Status | Output |
|-------|--------|--------|
| 1 | Done | {source archived: N files}, {N Gemini discrepancies}, {N repeat asks flagged}, {N codebase files scanned}, {N sections proposed}, {N questions resolved} |
| 2 | Pending | — |
| 3 | Pending | — |

**STOP — Wait for user to approve the proposed structure before proceeding to Phase 2.**

## Phase 2 — Write the PRD (all files)

After I approve the structure, write the complete PRD as a directory in docs/prds/ with:

### README.md
- Status, dependencies, blocks
- Source material with Gemini accuracy notes
- What this PRD covers (numbered list matching section files)
- What's NOT in scope
- Sections table linking to each file
- Key decisions table (D1, D2, ... with rationale from transcript quotes)
- What Already Exists table (current state → PRD changes)
- Schema changes summary (or "no schema changes" with verification) — schema lives in `packages/db`, migrations via `npm run db:generate -- --name <label>`
- New/modified/removed infrastructure tables
- Implementation order diagram showing dependencies between sections
- Recommended implementation sequence (which can be parallelized, which are sequential)

### Numbered section files (01-xxx.md, 02-xxx.md, ...)
For each section:
- Problem statement (what's wrong or missing)
- Decision references (D# from README)
- Fix description
- Implementation details with specific file paths, component names, props, and pseudocode
- Acceptance criteria as checkbox items
- Architecture review notes inline (if applicable)
- Files likely modified / created

### PROGRESS.md
- Pre-implementation checklist (things that must be done before any section)
- Per-section checkbox items matching the acceptance criteria
- Architecture review codes (C#, W#) referenced inline where relevant

### TEST-PLAN.md
- Prerequisites (database state, pre-implementation items, dev servers — internal on :3000, client on :3001)
- Per-section test items converted from acceptance criteria into testable checkboxes
- Edge cases: empty states, error states, concurrent actions, rapid inputs, boundary values
- Permission checks: admin vs CLIENT role scoping where relevant (no RLS — all access control is application-layer)
- Regression checks for adjacent features that should NOT break
- Summary table with test counts per section and total

### Future scope file (##-future-scope.md)
- Everything discussed but explicitly deferred, with context for why and when to revisit

**Output the completion table:**
| Phase | Status | Output |
|-------|--------|--------|
| 1 | Done | ... |
| 2 | Done | {N files written}: {file list} |
| 3 | Pending | — |

## Phase 3 — Review & Polish

After writing all files:
1. Do a self-audit for internal consistency (cross-references, file paths, decision numbering, URL formats, no contradictions between sections).
2. Fix any issues found.
3. Present a summary of what was created.

**Output the final completion table:**
| Phase | Status | Output |
|-------|--------|--------|
| 1 | Done | ... |
| 2 | Done | ... |
| 3 | Done | {N inconsistencies found and fixed}, PRD clean: yes/no |

$ARGUMENTS
