# PR #279 overnight report (Oct 29–30, 2026)

## Read this first

- **Nothing failed the rehearsal.** On a copy of production, all 24 migrations (0089–0112) ran in one transaction in about a second. All 41 data checks pass. The documented rollback returns the copy exactly to its 0104 state, schema and data. The browser suite passes against that copy as an admin, as Sales and with the portal preview.
- **The production copy is from Oct 29 17:13, not fresh.** A new read-only `pg_dump` needs the production connection string, and this machine's permission check (rightly) blocked me from reading the credentials file. To rehearse on a fresh copy, run these two commands yourself; the second is local only:

  ```bash
  pg_dump "$PROD_DATABASE_URL" -Fc -n public -n drizzle -n auth -f ~/Backups/pts-portal/prod-$(date +%Y%m%d-%H%M).dump
  scripts/rehearse-rollout.sh ~/Backups/pts-portal/prod-<timestamp>.dump
  ```

- **One money question needs you before release** (decision 1 below). The monthly close filters clients by whether they are billed **today**, not in the month being reported. This predates the PR, but "stop billing" is now one switch, so it will come up.
- **I narrowed the 0112 scope.** I did not move the 38 foreign keys that point at `users` (decision 2).

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
- **September 2026 close:** $5,200 billing in and $4,462.50 payouts, identical before and after, on the local copy and the rehearsal app.
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

## Decisions for Jason

1. **What does the monthly close count when a client stops or restarts billing?** Today, billing, origination and closer rows filter on the client's state now. A client stopped on Oct 15 drops out of any month not yet closed, and archiving a company does the same.
   - (a) Filter by the period instead: `client_since` before the period end, and `client_ended_at` empty or after the period start.
   - (b) Keep it as is.

   **Recommend (a).** Ship it with a check that every closed month's totals are unchanged. (I didn't change money logic overnight.)
2. **The 38 foreign keys that still point at `users`.**
   - (a) Leave them all.
   - (b) Move only the person-meaning ones (commission origination and closers, assignee, owner) to contacts after the release.
   - (c) Move them all.

   **Recommend (b).** Commission can name one human two ways today (user or contact). The close pays staff and outside originators differently and keys payouts by user id in snapshots, so it needs its own migration and rehearsal.
3. **Stop and restart billing history.**
   - (a) Add billing periods: stop and restart each take an effective month, and restart opens the terms.
   - (b) Keep one since/ended interval.

   **Recommend (a)**, together with decision 1.
4. **One transaction per sheet Save.** The company sheet saves the company, then billing, then portal access, in separate server actions. A failure part-way leaves a half-saved company. **Recommend** one `saveCompanySheet` action. The person sheet's sign-in steps have the same shape; they should log activity too (they currently don't).
5. **Who can edit staff and sign-in people?** Sales can rename an admin or a portal person and remove staff from the Place To Stand company (which is found by name). **Recommend:** people with a sign-in are editable by admins only, and the staff company is identified by a flag, not its name.
6. **Can Sales see portal-access and sign-in fields?** They can read them (not change them) on companies, people and through MCP. **Recommend** hiding them unless the viewer can manage clients.
7. **How does someone get portal access?**
   - (a) Turning Portal on in a company's People tab creates the Client sign-in on Save.
   - (b) Keep it two steps.

   **Recommend (a).** Today a Client sign-in without the Portal switch lands on "You haven't been added to a client yet".
8. **Won leads.**
   - (a) A lead needs a company before Won.
   - (b) Billing a won lead's company creates it from the lead.

   **Recommend (a).** Moving a lead to Won should swap the lead sheet for the company's Billing tab, rather than opening a sheet over a sheet.
9. **⌘K.** **Recommend** replacing the Clients group with Companies, showing a Client badge.
10. **New company in one pass.** The create sheet has only Details, so you create, close and reopen. **Recommend** showing all four tabs on create; this depends on decision 4.
11. **Old client ids.** The map is "for one release", but a few old activity rows' metadata still hold client ids. **Recommend** keeping `archive_sales_tools.client_id_map` permanently; it's tiny.
12. **Cascades.** `hour_blocks` and `client_updates` cascade-delete with their company, and time logs and comments cascade with their sign-in. Nothing in the app hard-deletes either today. **Recommend** changing these to RESTRICT as a safeguard.

## What you're not seeing about the structure

- **Three definitions of "is a client".**
  - `isClientCompany()`: billed and not archived.
  - `clientEndedAtSql`: ended or archived.
  - The portal view: billed, now also not archived.

  They agree today only because archiving revokes portal access. Pick one SQL definition and build everything on it.
- **"Client" naming is everywhere.** `clientId` means a company id about 570 times; `lib/settings/clients` holds billing; activity writes `targetType: 'CLIENT'` with a company id beside `COMPANY` events, so a company's feed needs both. The next developer will look for a `clients` table. Fold `lib/settings/clients` into `lib/companies/billing` and rename `clientId` → `companyId` in one mechanical pass.
- **Role lives in two places:** `users.role` and the staff membership title ("Partner" / "Sales"). Changing one doesn't change the other. Payroll in the close also keys on the current role, so changing a partner's role mid-month moves their hours.
- **Billed rows can point at any company.** Foreign keys now go to `companies`, so "the billed party is a client" is enforced only by the app. A CLIENT project can be saved on a company with no slug. Add an `ensureClientCompany` check in project, hour-block and invoice saves.
- **Stale generated types.** `lib/supabase/types.ts` still describes `clients`, `users.full_name` and `users.avatar_url`. `AppUser` is built from it, and the `DbClient` / `DbUser` twins in `lib/types.ts` carry old names. Regenerate them or delete them in favour of Drizzle types.
- **The queries layer holds business logic.** `lib/queries/companies.ts` (850+ lines) mixes permission checks, transactions and mutations.
- **Release risk:** it's a hard cut-over. Old code fails the moment the batch commits, so the window must include promoting both apps. Re-run `scripts/rehearse-rollout.sh` on the day: two guards depend on that day's data (0108's "term in force this month" and 0109's contact email uniqueness).

## How to rerun

- Rehearsal on a production dump (local only): `scripts/rehearse-rollout.sh <dump>`.
- Data comparison alone: `node scripts/compare-rollout.mjs --before <local url> --after <local url>`.
- Browser suite (local apps only): `npm run test:e2e`. Add `E2E_PROD_COPY=1` on a production copy, `E2E_WRITES=1` on a throwaway database, and `E2E_BASE_URL` / `E2E_PORTAL_URL` for other local ports.
