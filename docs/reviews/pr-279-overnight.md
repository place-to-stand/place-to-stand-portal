# PR #279 overnight report (Oct 29–30, 2026)

## Read this first

- **Nothing failed the rehearsal.** On a copy of production, all 24 migrations (0089–0112) ran in one transaction in about a second. All 41 data checks pass. The documented rollback returns the copy exactly to its 0104 state, schema and data. The browser suite passes against that copy as an admin, as Sales and with the portal preview.
- **The production copy is from Oct 29 17:13, not fresh.** A new read-only `pg_dump` needs the production connection string, and this machine's permission check (rightly) blocked me from reading the credentials file. To rehearse on a fresh copy, run these two commands yourself; the second is local only:

  ```bash
  pg_dump "$PROD_DATABASE_URL" -Fc -n public -n drizzle -n auth -f ~/Backups/pts-portal/prod-$(date +%Y%m%d-%H%M).dump
  scripts/rehearse-rollout.sh ~/Backups/pts-portal/prod-<timestamp>.dump
  ```

- **Every decision is answered and built** (below): the close counts clients by the months they were billed, and every closed month is unchanged.
- **0112 scope (settled by Jason):** the 38 "who did this" foreign keys stay on `users`, the sign-in.

## What landed tonight (all pushed to PR #279)

| Commit | What |
| --- | --- |
| 3f42b3db | Palette B as the app colours; a time log entity (Clock, green) and hour blocks on Hourglass. One entity registry (`lib/entity-accents.ts`) for every icon and colour, with lint that fails on drift. Shared `Alert` with a warning variant (lead person/company mismatch). Pagination fits a phone. Design system rule added to CLAUDE.md, AGENTS.md and the skill. |
| 088df49d | Every in-app link goes straight to its page (no redirect-only routes). One row height for every list, set in the shared `TableCell`. |
| 64c40d86 | **Migration 0111:** a client is a company you bill. `clients` is folded into `companies`, every `client_id` is now `company_id`, and the term tables are renamed. The CLI and MCP keep `clientId` as an alias and accept old client ids for one release. |
| 3478cf12 | **Migration 0112:** the photo lives only on the person; `users` is just the sign-in. |
| ee7c73d2 | `scripts/compare-rollout.mjs` (before/after data checks). 0106 and 0109 now record what they create, so the rollback is exact. |
| 63118213, bdc074af | Playwright browser suite in `e2e/` (`npm run test:e2e`). The portal preview lists only people who can see the portal. |
| f7471996, c6376c0a | Fixes from the reviews (see below). |

`:3003` ran only code that builds. 0111 and 0112 were each switched over by stopping the server, migrating, fast-forwarding and restarting. A backup was taken first each time (`~/Backups/pts-portal/local-3003-pre011{1,2}-*.dump`).

## Rehearsal (production copy of Oct 29 17:13)

- **Forward run:** 0089 → 0112 in one drizzle transaction, about 1.1s, behind the network guard.
- **Data checks** (`scripts/compare-rollout.mjs`, 41/41 pass):
  - every row kept, for people, sign-ins, projects, tasks, time logs, hour blocks, invoices, leads, comments, assignees, activity and close snapshots;
  - new people are only sign-ins' and leads' people;
  - every client is on its company with the right slug, state, notes, live/former state, billing type, billing terms, commission terms and closers;
  - projects, hour blocks and invoices are on the client's company, with timestamps untouched;
  - every foreign key resolves, with no new orphans;
  - every sign-in is on the right person, and every live sign-in has exactly one person;
  - email, role and off switch are unchanged, and photos moved to the person;
  - portal access is identical (no grant lost or gained);
  - people at two companies keep both;
  - every closed-month snapshot is unchanged once ids are mapped;
  - hours bought, hours logged and invoice totals per client are unchanged.
- **September 2026 close:** $15,850 billing in and $14,657.50 payouts, identical before and after and equal to its snapshot. (An earlier version of this report gave $5,200 / $4,462.50: that was October to date, not September.)
- **Undo:** run on a second copy after the whole batch. 0112-undo, then 0111-undo, then the §5 blocks for 0110, 0109, 0108 and 0105–0107. It returns the copy to exactly its own 0104 state (schema, constraints, indexes and every table's data) in under a second. Option B goes back to the 0104 shape; going all the way back to production's current code is still Option A (restore the backup).
- **Browser suite on a throwaway app over the migrated copy:** 72 pass; the 2 skips are lists with fewer than two rows. The data-changing tests (make, stop and restart billing; the lead warning and its fix) ran only there.
- **Found in production data:**
  - A few `time_log_tasks` rows fail their own check `time_log_tasks_project_match`. It reads other tables, which changed after the rows were written. The batch never writes those rows, but any future update to them will fail.
  - Some activity rows point at clients that no longer exist. They were orphaned before the batch and stay so.
  - Production's migration table has one more row than the repo, an old migration no longer in the repo. The rollout doc's "89 rows" was wrong and is fixed.

## Reviews run, and what was fixed

| Review | Result |
| --- | --- |
| Codex review (whole PR) | 2 findings, both fixed: photo seeding wrote to the dropped `users.avatar_url`, and the portal hours card read a billing term scheduled for a later month. |
| Codex adversarial (tonight's commits; the whole-PR diff is too large for its git buffer) | Fixed: 0111 now stops on a company with two client records; the rollback keeps rows moved after the release, keeps reclosed reports, and restores notes and websites only where untouched; the e2e suite checks both apps are local. |
| Claude correctness review | Fixed: permanent client delete (needs billing stopped; blocked by invoices and updates; removes starting terms); restore on an archived company; stopping twice; `updated_at` on billing writes; a stray `companyId`; the staff company lookup. Email sync and the close's "today" filter are below. |
| Claude adversarial design review | Fixed: Sales could restore an archived client company; archived people lost their name in history; a person with a sign-in could be permanently deleted; dead code. Design risks are in the decisions below. |
| Security review | No high issues. Fixed: a CRM user could move any photo in the bucket onto any person; the email is now checked before saving; the role is validated. |
| Database review | Fixed: the rollback's handling of post-release writes; the leftover `log_activity()` helper; the portal view now also excludes archived companies. |
| audit-prd (engineer and product roles, against the repo's plan docs) | Fixed: the last `/clients/` links (⌘K and home widgets); "user"/"account" wording in the client portal and internal pickers; "Bill this company" wording; the briefcase on lead conversion and ⌘K; "Photo"; tooltips sending you elsewhere; stale docs. |

The earlier audit decisions (`audit-decisions.md` in the project files) aren't reachable from this machine. I treated every decision recorded in the repo docs and this week's thread as made.

## Decided and built (Oct 30)

Jason answered every decision with the recommendation; all of it is built in this PR.

| # | Decision | What it does now |
| --- | --- | --- |
| 1, 3 | The close counts by period; billing periods | `client_billing_periods` (0113) holds each stretch of billing by month. The close counts a client in every month a stretch covers. Start, stop and restart each take "this month" or "next month" ("Bill through the end of this month" / "Stop now"). On the production copy every month's full report is byte-identical before and after, and every closed month still matches its snapshot. |
| 2 | The 38 "who did this" keys stay on `users` | Settled. |
| 4 | One Save, one transaction | Every sheet (company, person, lead, task, project, invoice, hour block) saves through one server action in one `db.transaction`; activity logs after commit. Supabase Auth steps run before the transaction and are undone if it fails. |
| 5 | Admins edit people with a sign-in; staff company by flag | Sales see those people read-only; `companies.is_staff` marks the staff company; only admins remove people from it. |
| 6 | Hide portal and sign-in fields from Sales | Sheets, the People list, MCP and CLI leave them out for anyone without `clients.manage`. Billing and portal-access events are hidden from them in every activity feed. |
| 7 | Portal switch creates the sign-in | Turning Portal on for a person without a sign-in creates their Client sign-in on Save; the invite goes out after commit. |
| 8 | Won needs a company | Refused without one (sheet, board drag, CLI, MCP); an admin saving a lead as Won lands on the company's Billing tab. |
| 9 | ⌘K | A Companies group with a Client badge replaces Clients. |
| 10 | New company in one pass | Create and edit show the same sheet (all four tabs); the rule now covers every sheet. |
| 11 | Old client ids | `archive_sales_tools.client_id_map` is kept for good. |
| 12 | Cascades | `hour_blocks`, `client_updates` → company and `time_logs`, `task_comments` → sign-in are RESTRICT. |

**Role in one place.** `user_role_terms` (0113) keeps each sign-in's role by month, seeded from Oct 2025; payroll counts Admin hours by the role in force for the month (Sales hours aren't tracked). An admin picks the month a role change takes effect (closed months can't be rewritten); a future change applies at sign-in and by a daily cron (`/api/cron/apply-role-terms`, uses the existing `CRON_SECRET`). Role changes are logged. The staff title is a free-text job title; becoming staff joins the Place To Stand company, becoming a Client leaves it. Archived people stay in the months they worked (payroll, closers, originators).

**Structure.**
- One SQL definition of client state: `company_is_client`, `company_billing_open`, `company_billed_in` (0113), behind `@pts/db/client-state`; the portal view uses it. `client_since` / `client_ended_at` are gone (0114).
- `clientId` is now `companyId` across the code (a field that meant "the company, while it is a client" is `clientCompanyId`). The CLI and MCP keep `clientId`. Closed-month snapshots and old activity rows keep their stored `clientId` and are read either way.
- Billing events are COMPANY activity (rows moved by 0113, undo restores them).
- `ensureClientCompany` guards project, hour-block and invoice saves.

**Sheet rules** (in `docs/design-system/components/sheet.md`, /design › Patterns, CLAUDE.md, AGENTS.md and the skill): one Save, one transaction; only Save writes; instant actions are their own records or act outside the app (comments, lead updates, logging time, invoice email/send/revert/void, acknowledging a submission, drafting a client update, planning, password reset); sending an invoice is blocked while it has unsaved edits; uploads go to staging and are claimed on Save; create and edit show the same sheet; related records stack.

**For Jason to know.**
- The client portal picks up a future-dated role change after the daily cron or the person's next internal-portal request.
- `user_metadata.role` is no longer written to Supabase Auth; nothing in the app reads it.
- `list_users` (MCP/CLI) still returns roles to Sales, for assigning work.
- Stopping billing still ends the company's portal access at once, even when billed through the month.
- Re-linking a previously unlinked GitHub repo restores the old link instead of failing.

## How to rerun

- Rehearsal on a production dump (local only): `scripts/rehearse-rollout.sh <dump>`.
- Data comparison alone: `node scripts/compare-rollout.mjs --before <local url> --after <local url>`.
- Browser suite (local apps only): `npm run test:e2e`. Add `E2E_PROD_COPY=1` on a production copy, `E2E_WRITES=1` on a throwaway database, and `E2E_BASE_URL` / `E2E_PORTAL_URL` for other local ports.

## Settled since (Oct 30)

- **Sheets stack.** Opening a related record from inside a sheet opens its own sheet on top; closing goes back. Written into `docs/design-system/components/sheet.md` and /design › Patterns.
- **There is no "no dialogs over sheets" rule.** Dialogs for small focused tasks over a sheet are fine, so the four (GitHub repo link, integration link, invoice email, log time from a task) stay as they are; that follow-up is dropped. The lead's "Add update" form, already made inline, stays inline.
- **The 38 "who did this" foreign keys stay on `users`.**
