# PR #279 swarm audit

Six reviews ran in parallel against 65fe1766:

- Principal Engineer (audit-prd step 1)
- Product Manager (audit-prd step 2)
- External-attacker security
- Internal role (RBAC) security
- UI and flow simplification
- Database and data-layer simplification

A migration rehearsal on a fresh production snapshot ran alongside them.

Findings with an obvious fix were fixed in seven helper branches and merged. Anything that changes behaviour, removes a feature, touches money logic or changes the schema is listed under **Decisions**, with a recommendation.

Finding ids are prefixed by the review that raised them:

| Prefix | Review |
| --- | --- |
| C/W/I | Engineering |
| P/PW/PI | Product |
| S | External security |
| R | Internal roles |
| U | UI/flow |
| D | Database |

Hands-on checklist: [pr-279-test-plan.md](pr-279-test-plan.md).

---

## 1. Migration confidence: 99%

The rehearsal used a read-only production dump taken 30 Oct 2026 (public, drizzle and auth schemas). It was restored only into local databases. Nothing ran against production.

| Check | Result |
| --- | --- |
| Forward 0089 → 0115 on the fresh copy | Applies in about 2 s; two runs, line-identical output |
| `compare-rollout.mjs` (41 checks): per-client billing, terms, commissions, hour blocks, invoices, memberships, sign-ins | 41 / 41 pass |
| `verify-migration.py`: row counts; 21 untouched tables byte-identical; every money value kept; auth untouched; every constraint and FK; client state = old live clients; one open period per live client; role terms; one person per sign-in | ALL CHECKS PASS |
| Monthly close, every month Oct 2025 → Oct 2026: old code on the old schema vs new code on the migrated schema | All 13 months identical (billing in, payouts, payroll rows) |
| Saved close snapshots vs recomputed totals | No drift |
| Undo 0115 → 0111 back to the 0110 schema | 0 differences |
| Browser suite on the migrated copy | 76 pass read-only, 84 with writes, 4 skipped (need live Gmail/GitHub) |

**Re-run after every fix was merged** (32172cfb, same dump):

- Forward 0089 → 0115 in 1 s (117 migrations).
- 41/41 compare checks.
- ALL CHECKS PASS.
- 13 months recomputed, 12 closed, none drifting.
- Undo differences: 0.

The browser suite on the migrated copy with the final code: 76 pass read-only; 85 pass with writes, 0 fail, 4 skipped.

**Why not 100%:** the rehearsal is only as good as the snapshot, and production keeps changing until release. The release-day steps (test plan §10) repeat the dump and the rehearsal. If they pass again, I'd treat the migration as certain.

Known and harmless (both were already in production before this PR):

- **5 `time_log_tasks` rows** link a time log to a task on another project. The new check is added NOT VALID, so these rows stay and new bad rows are refused.
- **18 activity rows** point at companies hard-deleted in Nov 2025. They're history only.
- **I8:** a client archived earlier in the release month counts as billed through that month after migration. Production has none today. The release-day checks look again.

---

## 2. Security findings by severity

| Sev | Id | Finding | Status |
| --- | --- | --- | --- |
| High | S1 | An auth account someone signed up for themselves was reused (and kept its password) when an admin later granted that email a sign-in | **Fixed**: the account is taken over first (new random password, sessions revoked). Defence in depth: decision below |
| High | S2 / R3 | A client-portal user could attach another organisation's GitHub App installation by guessing its id | **Decision** (GitHub app setting + code) |
| Medium | S3 | Open redirect after sign-in via `/\evil.com` | **Fixed** (shared safe-redirect helper, 6 sites + reset form) |
| Medium | S4 | Stored XSS: Sales uploads HTML as an "image", sets the type to text/html, an admin opens it | **Fixed** (type allowlist; non-images download; sandbox CSP) |
| Medium | S5 | Stripe payment amount never checked against the invoice total (pay old total after an edit → marked PAID) | **Fixed** (reuse only matching intents; webhook requires full amount) |
| Medium | R1 | Sales could rename any person, including admins, through a lead save | **Fixed** |
| Medium | R2 / W2 | Sales could archive or rename the staff company, breaking every later role change | **Fixed** (admin only; archived staff company is found and restored) |
| Medium | R4 | Sales can add a person to a client company through a lead save | **Decision** |
| Medium | R5 | Sales could move people with sign-ins between companies via the company sheet | **Fixed** |
| Low | S6 | Avatar save could move any file in the photo bucket | **Fixed** |
| Low | S7 | Anyone with the public key could call SECURITY DEFINER functions | **Fixed** in 0115 (revoked; dead functions dropped). Data API off: decision |
| Low | S8 / R12 / I4 | Scheduled role changes weren't applied on CLI, MCP or the client portal until the nightly cron | **Fixed** |
| Low | S9 | Editor sanitizer failed open | **Fixed** (also nested children) |
| Low | S10 | No app-side throttle on password sign-in | **Decision** |
| Low | R6 | Sales could set titles on client people | **Fixed** |
| Low | R7 | Sales can read and edit client notes | **Decision** |
| Low | R8 | Sales could archive a client's primary contact | **Fixed** |
| Low | R9 | Sales could restore an archived person with a sign-in | **Fixed** |
| Low | R10 | Sales moving a Won lead back clears the admin's conversion link | **Decision** |
| Low | R11 | Portal-invite events visible to Sales | **Fixed** |
| Low | R13 | Confirming an auth email change could un-archive a sign-in | **Fixed** |
| Low | R14 | Anyone can edit or delete anyone's lead update | **Decision** |
| Info | S11 / R15 | Malformed ids caused 500s in the client portal | **Fixed** (UUID checks) |
| Info | S12 | Unauthenticated cache-revalidation server actions | **Fixed** |
| Info | S13 | CLI accepts MCP tokens (same user) | Accepted |

**One thing to confirm on release (S1):** the takeover signs the reused account out by deleting its rows from `auth.sessions` and `auth.refresh_tokens`. On standard Supabase the `postgres` role has DELETE there, and the local copy matches. If production lacked that grant, the save would fail with an error rather than link the account (fails closed).

---

## 3. Fixed

| Area | Fix | Commit |
| --- | --- | --- |
| Money | W5 / I1: company save locks the company and re-checks the closed month inside the transaction | 7a8370b1 |
| Money | W11 / D2: as-of billing and commission subqueries name their table | b91e2a44 |
| Money | D29: dashboard counts prepaid hours by billing month, as the close does | b2f571cc |
| Money | D3: "is a client now" read through one helper everywhere | 601a8d69 |
| Money | S5: Stripe amounts must match the invoice | 23772e8a |
| Activity | W10: stop/restart billing log clear lines ("last month billed …", "cancelled the scheduled stop") | 7a8370b1 |
| Activity | W9: a lead save that restores an archived person is logged | 3959049c |
| Roles | W7: scheduled role changes skip archived sign-ins and are logged | 7a8370b1 |
| Roles | D13: dev `make-me-admin` writes the role term | 8ea180c3 |
| Roles | I2: a new sign-in's first role term skips a closed month | b72d31d2 |
| Sign-ins | W8: restoring a client sign-in lifts the off switch and ban | b72d31d2 |
| Sign-ins | I6: portal sign-ins no longer write a role into auth metadata | b72d31d2 |
| Sign-ins | I7: a slug-retry failure no longer leaks prepared auth users | 7a8370b1 |
| Permissions | R1, R2, R5, R6, R8, R9, R11 (see §2) | 3959049c, ddfc660b, bee50c09, b529a024 |
| Security | S1, S3, S4, S6, S8, S9, S11, S12, R13 (see §2) | cb3a6596 … 5ec0f193 |
| Data | W1 / D1: project owner links to the right person | 2d9f72df |
| Data | W2: staff company found even when archived | 4787691a |
| Database | 0115: helper SQL functions not callable through the API; dead definer functions and a broken `activity_logs` trigger dropped (undo file included) | eece82c4 |
| Dead code | W6 / U1: old client mutation stack (could bypass the sheet's guards); U7 unused Gmail helpers; U3, U5, U6 unused exports and params; D9 `website.ts`; D5 partial | 253c2b49, 4a99550b, 2444c24b, b6add3df, dfdb2f9e, ce35e1e8, 3ff33b17 |
| Copy | PW10, PI5, PI6 client portal; PI2, PI3, U35 sheet copy; U34 pickers ("Search people…", "Staff"); P3 invite line on the People tab | 53445246, b26de7f2, 2f833398, 5f23f7a2 |
| Docs | D28 / W12 CLAUDE.md client state; U36 `/design` specimens; D25 shared `activeCompanySql` | 949d8509, ede4e772, e9ec6274 |
| Tooling | `verify-migration.py` in the rehearsal | c25ef91a |

Second wave (product, UI and data-layer cleanups with an obvious answer):

| Area | Fix | Commit |
| --- | --- | --- |
| Billing tab | PW1 / U15: one "which month" picker. Stop is "Last month billed: October 2026 (this month) / September 2026 (last month)"; start is "First month billed". Labels use UTC, like the server | 35286dae, a7b88fd6 |
| Billing tab | PW5: plain help text ("October's close uses the new type"); PW13: "Terms" and "Tax state"; PI8: "Their people can use the portal now." when billing starts next month | 4a915261, e34d67f6, d40848c0 |
| Company sheet | PW8: Projects tab only for clients, or former clients with projects; "Create project" opens the project sheet prefilled with the company; a project with no slug isn't a dead link | 70a3a288 |
| Company sheet | Sales sees the staff company's Archive action disabled with the reason (the server already refused) | 91700e23 |
| Leads | PW6: a Won drag on the board opens the company's Billing tab for admins; PW7: a refused Won drag opens the lead with the error on Company | e9df311a, 3df262bb |
| People | PW11: company filter lists every company ("All companies"); a non-client filters by who works there | fde059b5 |
| People | U27: client row shows one portal note, not a tooltip too | 79fcb3d3 |
| Sheets | U23: edit sheets are titled with the record's name and show the entity icon | 447a099c |
| Sheets | U17: one archive confirmation ("Archive project?" … "Its history stays.") | a91e429c |
| Sheets | U19 / U20: shared empty states; "Add … after you save" sections | e72a6297, 7032613a |
| Sheets | U25: footer props renamed to archive* (no behaviour change) | 63030d33 |
| Components | U11 / U16 / U13: shared project and invoice record rows, one project status badge, one staff-or-person picker | d53e9479, 449dc58a, 8c173910 |
| Routing | U4: dead `?client=` params removed; `/settings/users?user=new` opens a new person | 237a1e50 |
| Caching | I11: company and person saves refresh the hour blocks, close, users, projects and leads pages | e710e25f |
| Data layer | D4, D7, D8, D11, D26, D28, U22, D6: simpler name subqueries, honest type names, one transaction type, one unique-violation helper, dead `saveCompany` and `/api/clients` removed | 17ccff3d … 8ec3dda1 |
| Tests | e2e follows the new labels; the project save test no longer races the refresh | bd8e7cfa, 32172cfb |

**Small calls made while fixing (say if you want any changed):**

- **"This month" labels count in UTC**, like the server. They used to use the browser's clock and could disagree with the save at midnight on the 1st.
- **The person sheet's "Role starts" picker** now looks like the billing month picker: a tinted callout.
- **Project status badges always use the outline style.**
- **Record rows open their sheet on top of the current one** (an hour block's invoice, a converted lead's company) instead of leaving the page. This answers part of U12.
- **A former client's Projects tab** now loads its history; before, it showed a loading skeleton forever.
- **The People company filter:** a client filters by portal access as before, and a non-client filters by who works there.
- **The person sheet no longer says "No portal access" anywhere.** It lived only in the tooltip that U27 removed.
- **U17 skipped the invoice, hour block, company, people and time-log archive confirms.** They sit next to billing copy or the pending company-archive decision (W4).
- **Not done (stay-out or not mechanical):**
  - D4: the avatar half; it would show an archived person's photo.
  - D8: the key rename.
  - I3.
  - I15: removing `company_id`.

---

## 4. Decisions for you

My recommendation comes first in each. None of these is built.

### Money and billing (decide before release)

- **C1. An hour block in a month the company isn't billed drops out of the close.**
  - How it happens: billing starts "next month", or a client is stopped "now" and then pays its last invoice. Either way the block lands in an unbilled month and is never counted, although its sales tax still is.
  - Production has no such rows today.
  - **Recommend:** count prepaid hour blocks whenever they're bought (they're cash), and date each company's first terms from its first billed month.
  - *Other:* move the block forward to the first billed month and refuse one when there's none.
- **W4. Archiving a company with billing open leaves it billed in every close,** and the sheet then can't stop it.
  - **Recommend:** refuse with "Stop billing first".
  - *Other:* archiving also stops billing from next month.
- **P1. "Bill through the end of this month" cuts the client's portal immediately,** while they're still billed for the month.
  - **Recommend:** keep access until billing ends (the database view already does this; skip the separate revoke).
  - *Other:* keep, and warn in the stop line.
- **P2. Restarting billing doesn't bring back portal access.**
  - **Recommend:** turn access back on for the people who had it when billing stopped.
  - *Other:* show the Portal switches under the restart line.
- **P5. Moving someone away from Admin defaults to "this month",** which takes their hours out of this month's payroll.
  - **Recommend:** default to next month when demoting from Admin, with a note if this month is picked.
  - *Other:* keep.
- **PW2. "Stop now" when hours were logged or a block was sold this month** leaves that work unbilled.
  - **Recommend:** a warning under the choice ("12 hrs logged this month won't be billed").
- **PW3. In a client's final billed month the switch reads "off" and the terms can't be edited.**
  - **Recommend:** keep the switch on with "Billing stops after October 2026. [Keep billing]" and the fields editable.
  - *Other:* keep.
- **PW4. Restarting a former client can't change its terms in the same Save.**
  - **Recommend:** show the terms, filled with the last ones, when restarting.
- **W3. Two admins saving the same company or person: the last save silently wins,** and the activity "before" is wrong.
  - **Recommend:** refuse a save if the record changed since it was opened ("Someone else saved this. Reload.").
  - *Other:* write only changed fields.
- **I10. Time on a client project in an unbilled month counts toward payroll but not Billing in.**
  - **Recommend:** keep (payroll is work-based), and I'll add a comment saying so.

### Security settings and permissions

- **S2 / R3. GitHub installation claim.**
  - **Recommend:** turn on "Request user authorization (OAuth) during installation" on the GitHub App, and check in the callback that the user can access that installation (a code change I'll make once the setting is on).
- **S1 (defence in depth).**
  - **Recommend:** turn off email sign-up in production Supabase (`[auth.email] enable_signup = false`). People are only invited. Google sign-in is unaffected.
- **S7.**
  - **Recommend:** turn off the Supabase Data API (the app never uses PostgREST). 0115 already revokes the functions.
- **S10.**
  - **Recommend:** a per-email and per-IP limit on password sign-in in both apps, like magic links. Today Supabase's limit sees one IP (Vercel's), which risks locking everyone out.
- **R4. Sales can add a person with no company to a client company through a lead save.**
  - **Recommend:** for non-admins, link the lead but skip joining a client company, as the person and company sheets already do.
- **R7. Sales can read and edit notes on client companies.**
  - **Recommend:** hide them from Sales on billed companies if the notes hold billing context.
  - *Other:* accept, and fix the capability description.
- **R10. Sales moving a Won lead back clears the admin's conversion link.**
  - **Recommend:** allow the move but keep the link.
  - *Other:* refuse the move for non-admins.
- **R14. Anyone can edit or delete anyone's lead update.**
  - **Recommend:** author or admin only, like task comments.

### Product

- **P4 / PW9 / U28. Portal access.**
  - The person sheet has no Portal control, and a Client sign-in can be created with no company access: the person gets an invite and lands on "not set up".
  - **Recommend:** a Portal switch per client company on the person sheet, the same control as the company People tab.
  - *Other:* refuse a Client sign-in without portal access somewhere.
- **PW12. Nav.**
  - **Recommend:** a "Billing" group with Invoices, Hour blocks and Monthly close (now under Sales and Reports). Sales users see no change.
- **PI1. Role month list (about 14 options, mostly disabled).**
  - **Recommend:** this month, next month, and the latest open earlier month.
- **PI4. The client portal's "Profile" menu has no profile.**
  - **Recommend:** label it with the person's first name.
- **PI7. Companies list opens on all 46 companies.**
  - **Recommend:** admins default to Clients, Sales to All, and the Client badge moves next to the name (drop the column).
- **PI9. A Net 30 client's Hours page talks about purchased hours and shows none.**
  - **Recommend:** show this month's logged hours to Net 30 clients.
- **U29. People list has both Companies and Clients columns.**
  - **Recommend:** drop the Clients column and mark clients with the badge in Companies.
- **U30. "Delete forever" exists on six entities,** against "never hard delete".
  - **Recommend:** remove hard delete from the UI and keep archive only.
- **U31. A lead can join someone to a company from a third place** (two alerts in the lead sheet).
  - **Recommend:** auto-join on save with a one-line note (non-clients only, see R4).
- **U25. Restore lives only in the company sheet;** elsewhere it's on the archive list.
  - **Recommend:** restore from list rows only, and drop it from the company sheet.
- **U12. Linked records sometimes stack a sheet, sometimes leave the page** (and skip "Discard changes?").
  - **Recommend:** always stack.
- **U18. Save errors show as a toast, inline, or both.**
  - **Recommend:** a save failure shows inline only; toasts only for success and instant actions.
- **U24. Seven sheets, five widths, two tab styles.**
  - **Recommend:** `lg` for simple forms, `xl`/`split` for records with lists, one tab component, and comments/updates as sections.
- **U21. Hours and money formatters are copied 7 and 10 times,** with different outputs.
  - **Recommend:** one shared pair in `@pts/ui`, output "1.5h" and "$1,234.00".

### Simplification (no behaviour change; follow-up PRs)

- **U2. One sign-in service instead of two pipelines** (about 250 fewer lines). Recommended.
- **U8. Retired routes are redirected three ways.**
  - **Recommend:** move them into `next.config` redirects, and drop the old `client`/`user` sheet keys after one release.
- **U9.** Move project and person code out of `settings/` paths. Recommended, as its own PR.
- **U10, U26, U32, U33.** File renames and splits of the 500–1,000-line files (company sheet, save-lead-core, invoice sheet, …). Recommended, gradually.

### Database (schema changes; after release)

- **D2 / D24. Billing type and commission "as of" are computed four ways, with different defaults.**
  - **Recommend:** SQL functions `billing_type_as_of` and `commission_term_as_of` with one explicit default. This removes the subquery bug class for terms.
- **D5.** Delete the stale `supabase/types.ts` once `lib/auth` stops using its two types. Recommended.
- **D6.** Swap hand-written `DbProject`/`DbTask` for the schema types (about 26 files). Recommended, as a follow-up.
- **D10 / D12.**
  - Consolidate the seven "list clients/companies" queries.
  - Move company write logic from `queries/` to `lib/companies/`.
  - Recommended, as a follow-up.
- **D14.** Commission parties: collapse user-or-contact pairs to one `contact_id`. Every user now has a person. Recommended after release.
- **D16.** Drop `activity_logs.context_route` (never written, 4,894 / 4,894 null). Recommended.
- **D17.** Drop 7 duplicate indexes. Recommended.
- **D18.**
  - Add `activity_logs(target_company_id, created_at desc)` and `activity_logs(actor_id)`.
  - Sync the declared sort order with the database.
  - Recommended.
- **D19.** `updated_at` triggers exist on 10 of 36 tables and no migration creates them. 0115 dropped the broken one. **Recommend:** drop the rest and rely on the app.
- **D21.** Remove `currentUserWithRole` from the schema (not in the database). Recommended.
- **D22.** Delete the unused `relations.ts` (629 lines). Recommended.
- **D23.**
  - Drop the 2 empty archive tables now.
  - Drop the other archive tables (keeping `client_id_map`) once the undo window closes.
  - Recommended.
- **D27.** Rename `lib/queries/clients/*` to `companies/billing`, and inline `clientNameSql`. Recommended.
- **D30.** Unused columns (`linkedin_url`, `due_date`, lead loss fields). **Recommend:** keep; they're features not yet used.
- **D15.** `activity_logs.target_company_id` is the company at event time. **Recommend:** keep, and add the D18 index.
