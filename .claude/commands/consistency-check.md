Do a final consistency pass across all files in the specified PRD directory.

**This command has 2 steps. Execute them IN ORDER. After each step, output the completion table.**

## Step 1 — Identify ambiguities and conflicts

Read ALL files in the PRD directory. Use AskUserQuestion to surface anything that's unclear, contradictory, or could be interpreted multiple ways. Keep asking until all ambiguities are resolved. Look for:

- Decisions that contradict each other across sections
- Implementation details that assume something not explicitly decided
- UX behaviors described differently in different places
- Scope boundaries that are fuzzy (is feature X in or out?)
- Component placement or URL formats that differ between files
- App ambiguity — features that don't clearly state whether they live in `apps/internal` (admin portal) or `apps/client` (client portal), or both

Do NOT silently pick an interpretation. Ask.

**Output the completion table:**
| Step | Status | Output |
|------|--------|--------|
| 1 | Done | {N ambiguities found}, {N resolved via AskUserQuestion} |
| 2 | Pending | — |

## Step 2 — Fix and verify

After all questions are answered, do the full consistency audit:

1. **Decision numbering** — all unique, no gaps, no duplicates, in order
2. **Cross-references** — all "see § X" and "see § X.Y" point to real sections that exist
3. **File path consistency** — every reference to a component/file path uses the same path across all docs, and paths are workspace-qualified (`apps/internal/...`, `apps/client/...`, `packages/db/...`) — never ambiguous bare `lib/` or `app/` paths
4. **URL format consistency** — all URL patterns match (no stale formats from before a decision change)
5. **Contradictions** — any place where one section says X and another says Y
6. **Stale content** — text still referencing old approaches that were changed during iteration
7. **Architecture review codes** — all C/W/I codes referenced in section docs match ARCHITECTURE-REVIEW.md
8. **Implementation order** — dependency diagram matches actual dependencies in each section
9. **Test plan coverage** — all acceptance criteria have corresponding test items

Report ALL inconsistencies found, fix them, then confirm the PRD is clean.

**Output the final completion table:**
| Step | Status | Output |
|------|--------|--------|
| 1 | Done | ... |
| 2 | Done | {N inconsistencies found}, {N fixed}, clean: yes/no |

$ARGUMENTS
