Create a branch, commit, push, and open a PR for the PRD at the specified directory.

## Instructions

1. Determine the PRD directory from the argument (e.g., `docs/prds/017-task-ui-polish/`). If no argument is given, look at recently modified files in `docs/prds/` to find the active PRD.

2. Extract the PRD number and name from the directory (e.g., `017` and `task-ui-polish`).

3. Create a branch named `prd-{number}-{name}` (e.g., `prd-017-task-ui-polish`).

4. Stage all files in the PRD directory.

5. Commit with message: `Add PRD-{NUMBER}: {Title from README.md H1}`

6. Push the branch and open a PR with:
   - **Title:** `PRD-{NUMBER}: {Title}` (from the README H1, under 70 chars)
   - **Body:** Include the "What This PRD Covers" numbered list from README.md, plus a link to the README for full details. Use this format:

```
## Summary
{Copy the "What This PRD Covers" numbered list from README.md}

## Details
See [README.md](docs/prds/{dir}/README.md) for full PRD with key decisions, implementation order, and architecture review.

## Files
- README.md — Overview, decisions, implementation order
- 01–NN section files — Implementation specs
- ARCHITECTURE-REVIEW.md — Pre-implementation audit findings
- PROGRESS.md — Implementation tracker
- TEST-PLAN.md — Manual test plan ({N} test items)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

7. Return the PR URL.

$ARGUMENTS
