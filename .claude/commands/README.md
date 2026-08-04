# Claude Code Commands — PRD Workflow

Type `/` in the Claude Code prompt to see all available commands.

## Workflow (10 steps)

### 1. Generate PRD from transcript

```
/prd-from-transcript <paste Gemini summary + raw transcript>
```

Turns a stakeholder feedback session into a complete PRD: README, numbered section files, PROGRESS.md, TEST-PLAN.md, and future scope. Proposes structure first for approval, asks clarifying questions, then writes everything. PRDs live in `docs/prds/` and use workspace-qualified paths (`apps/internal/...`, `apps/client/...`, `packages/db/...`).

### 2. Check for ambiguities and conflicts

```
/consistency-check docs/prds/0XX-name/
```

Asks questions about anything unclear or contradictory across the PRD files. After all questions are answered, audits for internal consistency (cross-references, file paths, decision numbering, stale content) and fixes issues.

### 3. Architecture + product review

```
/audit-prd docs/prds/0XX-name/
```

Reviews the PRD as a principal engineer (verifies schemas, queries, components, server actions, permission checks, missing items against the actual codebase) and as a product manager (reads the Place to Stand agency website, evaluates fit for the two personas: agency admin in the internal portal, client in the client portal). Asks questions for every finding that requires a decision, then incorporates answers into all PRD files.

### 4. Final consistency check

```
/consistency-check docs/prds/0XX-name/
```

Run again after the audit to catch any new ambiguities or contradictions introduced by the architecture review (new C/W codes, updated file paths, changed decisions). Same process: ask questions, then audit and fix.

### 5. Submit PRD as a PR

```
/submit-prd docs/prds/0XX-name/
```

Creates a branch, commits the PRD files, pushes, and opens a PR. The PR stays open through the remaining steps (review, implementation, testing).

### 6. Review and fix (on the PRD)

```
/review-and-fix
```

Runs a comprehensive multi-reviewer pass: fetches existing PR comments (Copilot, teammates), then launches Claude code-review, Codex standard review, and Codex adversarial review in parallel. Converges and deduplicates all findings, triages each as Fix or Skip, presents the table for approval, fixes legitimate issues, commits and pushes.

### 7. Implement the PRD

```
/implement-prd docs/prds/0XX-name/
```

Works through the PRD's recommended implementation sequence on the same branch/PR. Handles pre-implementation checklist items first, then implements each section in dependency order. Updates PROGRESS.md and TEST-PLAN.md after each section. Commits and pushes as sections are completed. Runs `type-check` and `lint` from the repo root (Turbo fans out to touched workspaces).

### 8. Automated browser testing + fix loop

```
/autotest-prd docs/prds/0XX-name/
```

Audits PROGRESS.md against the actual codebase (checks off done items, unchecks stale ones), then runs through TEST-PLAN.md using `agent-browser` to automate every testable item across both apps (internal :3000, client :3001). Failures trigger a diagnose → fix → re-test loop (max 2 attempts per item). After all automated tests, **writes a `MANUAL-TEST-PLAN.md` file into the PRD directory** with three sections: (A) high-priority failed/flaky/observed issues, (B) items that couldn't be automated and why, (C) gut-check items that passed automation but still need a human eyeball. This file is committed alongside any autotest fixes so it survives across sessions for step 9.

### 9. Manual testing + fine-tuning

```
No command — this is hands-on work with small prompts.
```

Open `docs/prds/0XX-name/MANUAL-TEST-PLAN.md` from step 8 and work through it sequentially (Section A first, then B, then C). Touch every feature for feel and polish — even automated-pass items, since things like drag-and-drop smoothness, animation timing, and layout balance require human judgment. Fire small prompts at Claude for tweaks as you go. Check off items in MANUAL-TEST-PLAN.md (and the corresponding TX.X items in TEST-PLAN.md) as you verify them.

### 10. Review and fix (on the implementation)

```
/review-and-fix
```

Same multi-reviewer pass on the implementation changes. Runs all four review sources again, converges findings, triages, fixes, commits and pushes.
