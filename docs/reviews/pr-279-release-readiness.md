# PR #279 release readiness (Nov 2, 2026)

Overnight readiness work for merging PR #279 (`claude/project-thread-ee2vhs`) and running migrations 0089–0116 on production. Nothing touched production: the only production read was the `pg_dump` Jason ran himself (`~/Backups/pts-portal/prod-20261101-2313.dump`, Postgres 17.11, 1,107 entries). Everything else ran on local copies, with outbound network blocked and email off.

## Bottom line

Ready to merge in the morning, after the four config and smoke steps below. Every check passed on tonight's production copy: migrations, data checks, the monthly close and undo. Two independent security reviews (a Claude reviewer and Codex) found no critical issues. Everything they found is fixed and has tests.

## What passed

**Rehearsal on tonight's production dump** (`scripts/rehearse-rollout.sh`, all 28 migrations including the new 0116):
- **Forward run:** exit 0 in 2s, ending at 118 migration rows (production has 90 today).
- **Portal role check:** passes (`scripts/check-portal-role.mjs`). Only a live Client sign-in gets portal access. Admin, Sales and switched-off sign-ins don't.
- **Comparison and verify checks:** 41/41 comparison checks pass (billing types, commission terms and closers, projects, hour blocks and invoices on the right company, every foreign key, people and sign-ins, photos, people at two companies, hours bought and logged, invoice totals per client), and the verify script reports ALL CHECKS PASS.
- **Monthly close:** all 13 closed months, October included, recompute exactly to their snapshots.
- **November** (still open): no hours logged yet; payroll and billing inputs are identical before and after.
- **October billable work:** 33.75 Admin client hours and 5 prepaid hours, the same before and after.
- **Undo:** every undo script (0116 → 0111, plus the doc's SQL) returns the database to exactly its 0104 state (0 differences).

**Nobody's access changes.** The same 3 portal users before and after. All 7 sign-ins keep their email, role and on/off state.

**Local checks**
- Both apps: type-check, lint and production build pass. CLI type-check passes. Entity, badge, permissions-manifest and design-token checks pass. Unit tests pass.
- Full e2e suite: see "Tests" below.
- **Phone width (375px):** the People and Companies lists, the person sheet (User section), the company sheet (Client section) and the filters fit, with no sideways scroll.
- **MCP tools**, called directly as Admin and Sales against the local copy:
  - Old client ids and new company ids both resolve.
  - Sales are refused on every billing, client and project tool.
- **CLI:** code review found nothing that breaks `pts`. It type-checks against the new API, and every response field it reads is still sent.

**Switching off "Can sign in"** is proven end to end (`e2e/tests/sign-in-off.spec.ts`) for Admin and Sales:
- the open session, API calls and the CLI bearer token are refused on the next request;
- a fresh sign-in link is refused (Supabase bans the user for 10 years, and every request re-checks `users.disabled_at`);
- switching back on restores access.

MCP tokens go through the same check as the CLI. For Client users, the portal view drops a switched-off sign-in (the portal role check).

## What was fixed tonight

1. **0116: the database requires the Client role for portal access.** Before this, an Admin or Sales sign-in with a leftover portal flag still got into the client portal, and its GitHub API routes, even though the sheets showed it locked. The client portal's `ensureClientAccess` also refuses any non-Client now.
2. **Ended sessions end their tokens at once (Codex, high).** Both apps verified a token's signature and expiry only. A token issued before its session ended (sign-out everywhere, or an orphaned sign-in taken over) kept working for up to an hour. Now every request also checks that the token's Supabase session still exists. Covered by an e2e test.
3. **Orphaned sign-ins are secured before re-linking.** Turning on Can sign in for an email that matches an old sign-in with no person now resets its password and ends its sessions first.
4. **Billing data kept from Sales.**
   - A client's billing type no longer reaches Sales through the person sheet's data.
   - The company sheet no longer sends Sales the billing end date or the "sign-in off" flag.
   - Portal changes are no longer listed in an activity line Sales can read.
5. **One rule for portal access** on both sheets and the server: only a live Client sign-in. No screen creates a sign-in as a side effect any more.
6. **MCP `list_activity`:** the old `CLIENT` target type and old client ids find billing activity again.
7. **Tests:** updated for tonight's UI changes, plus new tests for the lockout, ended sessions, Admin→Client and Sales→Client.

## The new session check (every request)

Since 29de6966, both apps' `getCurrentUser` also requires the token's Supabase session to exist in `auth.sessions`.
- **Every token has a session id.** Verified locally on real tokens: link and recovery sign-in, refresh (same session id), password sign-in, and magic or invite link verify all carry `session_id`. A token without one isn't a user session and is refused.
- **Cost:** one primary-key lookup, 0.05 ms in the database and about 0.3 ms round trip locally (expect roughly 1–3 ms through the production pooler). It runs once per request: `getCurrentUser` is wrapped in React `cache`.
- **The app can read `auth.sessions` in production.** Production code already reads `auth.users` directly (the last-sign-in times), and the takeover code deletes from `auth.sessions`, through the same database role. To confirm, run this read-only query, once, before merging:
  ```sql
  BEGIN READ ONLY; SELECT has_table_privilege(current_user, 'auth.sessions', 'SELECT'); ROLLBACK;
  ```
  It should return `t`.
- **It fails open on an error.** If the query errors (e.g. no permission), it logs and allows the already-verified token, which is the old behaviour, instead of signing everyone out. If the check runs and finds no session row, the user is signed out.
- **After release:** everyone's existing session keeps working. Anyone whose Supabase session row is already gone (e.g. signed out elsewhere) just signs in again.
- **CLI and MCP** validate through Supabase `getUser`, which checks the session server-side, so revoked sessions are refused there too (Codex second pass).

## Reviews

- **Claude security reviewer:** no critical or high findings. 5 lower findings, all fixed.
- **Codex adversarial review, pass 1:** one high finding (ended sessions kept their tokens valid), fixed.
- **Codex adversarial review, pass 2:** approve, "no material findings".
- **CLI and MCP compatibility review:** nothing breaks. Two meaning changes fixed (`list_activity`).

## Tests

<!-- filled in below -->

## Remaining risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| A Stripe payment that settles later never marks its invoice paid | Medium, until the webhook config is done | Morning step 1 |
| The daily role cron fails without `CRON_SECRET` | Low (other crons already use it) | Morning step 1 |
| The invite email or its link misbehaves in production (email is off locally) | Low–medium | Morning step 6: test on yourself before telling the team |
| A real portal user's sign-in on the client portal (not testable locally against the same database as the internal app) | Low (view and checks covered) | Morning step 7 |
| Signed-in staff see errors for a minute during the window | High, harmless | Off-hours; tell Kris and Dave |
| An external agent compares an old cached `clientId` with new output (ids are now company ids) | Low | Old ids still resolve as input |
| Rolling back after the team starts working loses their new work | Low | No going back after the smoke test (runbook step 13) |

## Morning steps (Jason)

Full runbook: `docs/migrations/sales-tools-rollout.md`, "Go-live runbook".

1. **Config and one read-only check:**
   - Run the `has_table_privilege` query above and expect `t`.
   - Stripe webhook endpoint: add `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`.
   - Vercel (internal app): confirm `CRON_SECRET` is set.
   - Vercel (both projects): confirm no dashboard "Ignored Build Step" overrides the new `claude/*` rule.
2. **Fresh dump** (the restore point), from the repo root:
   ```bash
   cd ~/Sites/place-to-stand-portal && PROD_DATABASE_URL=$(grep '^DATABASE_URL=' apps/internal/.env.prod | cut -d= -f2- | tr -d '"' | sed 's/[?&]pgbouncer=true//') && pg_dump "$PROD_DATABASE_URL" -Fc -f ~/Backups/pts-portal/prod-$(date +%Y%m%d-%H%M).dump && echo done; unset PROD_DATABASE_URL
   ```
   Then I rerun `scripts/rehearse-rollout.sh` on it (about 2 minutes).
3. **Tell Kris and Dave:** about 15 minutes, don't edit.
4. **Merge #279** to main, and don't promote yet.
5. **Migrate:** from `packages/db`, run `npm run db:migrate:prod; echo "exit $?"`. Expect `exit 0`, then 118 rows in `drizzle.__drizzle_migrations`.
6. **Promote** the internal app, then the client portal. Then give yourself a sign-in on a throwaway person and check the invite email arrives and works.
7. **Check the client portal** as one real portal user (or Preview as them), and run `pts whoami`. Then tell the team.
