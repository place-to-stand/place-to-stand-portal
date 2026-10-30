# PR #279 resume note (30 Oct 2026, 16:28 UTC)

## Done

- Swarm audit: every obvious fix merged and pushed to `claude/project-thread-ee2vhs` (head e1380e44 plus this note).
- Checks on the final code:
  - lint, type-check and build pass;
  - e2e: 76 pass read-only, 85 pass with writes, 0 fail;
  - fresh-dump rehearsal: 41/41 compare checks, ALL CHECKS PASS, no close drift, 0 undo differences.
- Report: `docs/reviews/pr-279-swarm-audit.md` (fixes, security by severity, decisions with recommendations, 99% migration confidence).
- Test plan: `docs/reviews/pr-279-test-plan.md`.
- :3003 and :3011 switched to e1380e44. The local DB was backed up first (`~/Backups/pts-portal/local-3003-pre0115-20261030-1127.dump`) and is migrated to 0115.

## In flight

Nothing. No helpers are running, and every branch is merged into the integration worktree `~/Sites/place-to-stand-portal-0111`.

## Next steps

1. Run the read-only e2e on :3003. Use the same command as for :3013, with `E2E_BASE_URL=http://localhost:3003 E2E_PORTAL_URL=http://localhost:3011`.
2. Send Jason the final report: hash, what's fixed, the top decisions, and links to the audit and the test plan.
3. Stop the rehearsal apps on :3013 and :3014.
4. Start the queued lint PR. Its own branch goes on top of this PR. Scope:
   - CI and pre-commit;
   - the drizzle subquery rule;
   - house rules as lint rules;
   - layering and server-boundary rules;
   - the copy and vocabulary check;
   - hygiene and type-aware rules;
   - a shared config for both apps;
   - files over 300 lines as a warning;
   - a check that every design-system rule names its guard;
   - docs/CLAUDE.md mapping each rule to the check that guards it.
