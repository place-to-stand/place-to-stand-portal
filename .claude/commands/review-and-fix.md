Run a comprehensive multi-reviewer pass on the current branch's open PR, then converge findings, fix legitimate issues, and push.

**This command has 6 steps. Execute them IN ORDER. After each step, output the completion table. Do NOT proceed until the current step is Done.**

## Step 1 — Gather PR context

Use `gh pr view` to get the current branch's open PR number. Use `gh pr diff` to understand the full scope of changes. Identify the base branch.

**Output the completion table:**
| Step | Status | Output |
|------|--------|--------|
| 1 | Done | {PR number, base branch, file count} |
| 2-6 | Pending | — |

## Step 2 — Fetch existing PR comments

Use `gh api repos/{owner}/{repo}/pulls/{pr_number}/comments` to get any existing review comments (from Copilot, teammates, or prior reviews). Collect these as the first set of findings. Summarize each comment (file, line, finding).

**Output the completion table:**
| Step | Status | Output |
|------|--------|--------|
| 1 | Done | {PR number, base branch, file count} |
| 2 | Done | {N existing comments collected} |
| 3-6 | Pending | — |

## Step 3 — Run parallel reviews

Kick off THREE reviews in a SINGLE message and block until ALL THREE return:

1. **Claude code-review** — Agent tool, subagent_type `feature-dev:code-reviewer`. Hand it the PR diff (`gh pr diff {number}`) plus your focus guidance (high-risk surfaces, CLAUDE.md conventions — especially application-layer access control and soft-delete filters — internal consistency). The Agent prompt accepts any focus text.

2. **Codex standard review** — Skill `codex:review` with args `--base {base} --wait`.
   ⚠️ **Pass NO custom focus/instruction text.** `/codex:review` maps directly to the built-in native reviewer and **rejects** focus text — it errors with "does not support custom focus text" and forces a wasted retry. It reviews the branch diff against `{base}` natively. `--wait` keeps it foreground and skips the wait-vs-background prompt.

3. **Codex adversarial review** — Skill `codex:adversarial-review` with args `--base {base} --wait {focus text}`.
   The adversarial variant **does** accept focus text after the flags — put all your challenge framing here (implementation approach, design choices, tradeoffs, edge cases, high-risk surfaces, things that will cause regret). `--wait` keeps it foreground.

Both Codex skills expand into foreground instructions that run the codex companion script — run those companion commands and collect their stdout. Because you passed `--wait`, neither prompts you to choose wait-vs-background.

**CRITICAL: Never set `run_in_background: true` and never background the Codex runs. Block until ALL THREE reviews have returned output. Do NOT proceed to Step 4 until you have all three.**

**Output the completion table:**
| Step | Status | Output |
|------|--------|--------|
| 1 | Done | ... |
| 2 | Done | ... |
| 3 | Done | {N findings from code-review}, {N findings from standard}, {N findings from adversarial} |
| 4-6 | Pending | — |

## Step 4 — Converge and deduplicate

Combine ALL findings from:

- Existing PR comments (Step 2)
- Claude code-review (Step 3.1)
- Codex standard review (Step 3.2)
- Codex adversarial review (Step 3.3)

Deduplicate findings that point to the same issue. Group by file. Count unique findings.

**Output the completion table:**
| Step | Status | Output |
|------|--------|--------|
| 1-3 | Done | ... |
| 4 | Done | {N unique findings after dedup} |
| 5-6 | Pending | — |

## Step 5 — Triage findings

For each unique finding, classify as:

- **Fix** — Legitimate issue that should be addressed (bugs, logic errors, missing error handling, missing permission checks, convention violations, real security concerns)
- **Skip** — False positive, stylistic preference, speculative concern without evidence, or suggestion that contradicts the project's established patterns in CLAUDE.md (e.g., a reviewer recommending RLS policies — this project deliberately keeps all access control in the application layer)

**Present the full triage table to the user** showing: source (Copilot/Claude/Codex/Adversarial), file, finding summary, and your Fix/Skip classification with reasoning.

**STOP HERE — wait for the user to confirm the triage before proceeding to Step 6.**

## Step 6 — Fix and push

After the user confirms the triage:

1. Fix all items classified as "Fix"
2. For items classified as "Skip", leave a brief note explaining why
3. Commit with message: `Address review findings from multi-reviewer pass`
4. Push to the PR branch
5. If there were PR comments from teammates/Copilot, reply to each resolved comment using `gh api` to indicate it was addressed

**Output the final completion table:**
| Step | Status | Output |
|------|--------|--------|
| 1-5 | Done | ... |
| 6 | Done | {N fixes applied}, {commit hash}, {N comments replied to} |

$ARGUMENTS
