# Sales tools rollout: production migration plan

Covers PR #279's database chain, migrations **0089 → 0112**, and the matching deploys of the internal app and the client portal. Nothing here has been run against production. This document holds no production data: the pre-flight queries produce the numbers and names to review at release time, and their expected values are shared outside the repo.

## Summary

1. This PR adds 24 migrations (0089–0112) on top of 0088. Pre-flight P0 confirms production is at 0088.
2. Net effect:
   - leads, contacts and clients are reorganised around **companies**;
   - people belong to companies through **memberships** (several per person allowed);
   - portal access becomes one flag on a membership, read through the `client_portal_access` view;
   - leads read their person's name, email and phone from the linked **contact**;
   - a client is its company's billing record and takes the company's name; a user is a person's sign-in and takes the contact's name (0109);
   - then (0111) a client is simply a company you bill: `clients` folds into `companies` (`slug`, `state`, `client_since`, `client_ended_at`) and everything keyed on `client_id` keys on `company_id`. Old client ids stay in `archive_sales_tools.client_id_map`; the CLI and MCP accept them for one release.
3. Every backfill runs **before** any drop.
4. 0107, 0108, 0109, 0111 and 0112 copy every table and column they drop into the `archive_sales_tools` schema.
5. 0097 also archives the three columns it drops, and 0090 archives every lead's company name as typed before it respells them (see [Archives made before 0107](#archives-made-before-0107)).
6. **Seven migrations stop the release on bad data** (drizzle runs the whole batch in one transaction, so a stop leaves production at 0088):
   - 0104: a company would end up with two live clients;
   - 0106: a lead with no contact;
   - 0107: a live portal grant would be lost, or someone would gain portal access they didn't have;
   - 0108: a client's origination or billing type differs from its newest term, an old term closer has no closer row, a live client has no billing term in force this month, a `contact_leads` row isn't its lead's contact, or an hour block's `invoice_id` isn't its line's invoice;
   - 0109: a client has no company, or a live user doesn't have exactly one live contact;
   - 0111: a client has no company, two clients of one company have billing or commission terms for the same month, a company has two live clients, or a client has a label;
   - 0112: a sign-in has a photo but no live person to keep it.
7. **Rollout shape:** one short maintenance window. Run 0089–0112, then immediately promote the new internal app and client portal builds. Old code can't run on the new schema, and the new code can't run before it, so a split rollout doesn't help (see [Order of steps](#1-order-of-steps)).
8. **Rehearse first** on a Supabase branch or restored snapshot, using the same commands and checks.
9. **Rollback:**
   - before 0107, roll back the code (the old tables are still there);
   - after 0107, rebuild from `archive_sales_tools` (SQL below) or restore the pre-migration backup.
10. **People with access to clients at two different companies** (P1 lists them) end with a membership at each company, with portal access carried over.

## Expected pre-flight values

Run the read-only pre-flight queries (P0–P14) and compare with the values shared in the project thread before the window. Anything different is a reason to stop and look before migrating. In particular: P1 (people with access at two companies) should list exactly the known cases, P2–P5 and P11 should all be 0, and P12 should show no `broken` trigger on a table the batch updates.

## The migrations

"Idempotent" means a second run finds nothing to do. drizzle-kit records each applied migration, so in normal use none runs twice.

| # | What it does to existing rows | Idempotent | Guard |
| --- | --- | --- | --- |
| 0089 `sales_tools` | Creates `companies` and `project_members`. Adds `contacts.job_title`, `linkedin_url`, `company_id`, `is_champion`, and `leads.company_id`. No row changes. | No (DDL) | — |
| 0090 `backfill_companies` | First copies every lead's `company_name` as typed into `archive_sales_tools.lead_company_names`. One company per distinct live lead company name (≤160 chars; longer ones stay unlinked). Links leads by name and normalises their spelling. Contacts take their latest lead's company via `contact_leads` (empty in prod, so no effect). Companies point at the client a lead converted to. | Data steps yes; the archive `CREATE TABLE` runs once | Stops if the archive table already exists. |
| 0091 `one_champion_per_company` | Unique index: one champion per company. | No (DDL) | Fails on two champions per company. None exist yet. |
| 0092 `notifications` | New table. | No (DDL) | — |
| 0093 `drop_company_owner` | Drops `companies.owner_id`. It only existed since 0089; the assignee stays on `leads.assignee_id`. | No | — |
| 0094 `contact_email_optional` | `contacts.email` becomes nullable. | Yes | — |
| 0095 `client_company_primary_contact_lead_contact` | Adds `clients.company_id`, `companies.primary_contact_id`, `leads.contact_id`. | No (DDL) | — |
| 0096 `backfill_contacts_companies` | 1) Every client gets a company: the converted-lead link, then a name match, else a new company named after it. 2) Every lead gets a contact: match by email (ignoring case), else one new contact per email, else a name-only contact. Archived-only leads get archived contacts. Fills `contact_leads`. 3) Contacts without a company take their lead's company, then their client's (primary client first). 4) Company primary contact comes from the champion, else the client's primary contact (only someone at that company). | Data steps yes. The two `ADD CONSTRAINT`s are not repeatable. | — |
| 0097 `drop_champion_company_client_primary_flag` | Archives, then drops, `companies.client_id`, `contact_clients.is_primary`, `contacts.is_champion` (see below). | No | Stops if an archive table already exists. |
| 0098 `drop_lead_email_unique` | Drops the unique-email index on leads (a contact can have several leads). | No | — |
| 0099 `client_label` | Adds `clients.label` (now unused; harmless). | No | — |
| 0100 `contacts_company_from_clients` | Contacts with no company join the company of their linked clients, when those are all one company. | Yes | — |
| 0101 `company_website_from_leads` | Company website ← newest live lead's website, only where the company has none. | Yes | — |
| 0102 `company_website_from_clients` | Company website ← newest live client's website, only where still empty. | Yes | — |
| 0103 `single_task_assignee` | Tasks with several assignees keep the first. The others are soft-deleted (`deleted_at`), so history stays. Then a partial unique index (`task_assignees_one_current_per_task`) keeps one current assignee per task. | Dedupe yes; index is DDL | Index can't fail: the dedupe runs first. |
| 0104 `client_company_one_to_one` | Unique index: one live client per company. | No (DDL) | **Stops** and lists companies with 2+ live clients. Nothing is merged automatically. |
| 0105 `memberships_and_portal_access` | Creates `memberships`. Step 1: everyone at a company (`contacts.company_id`) gets a membership with their title and primary flag. **Portal access carries over only where it was real:** a portal login (`client_members`) for that company's **live** client. `contact_clients` was a CRM link (who belongs to a client), not access, so it only creates the membership, with access off. Step 2: every other tie (a client link or a login at another company, or being primary without working there) becomes an extra membership, so no link is lost. Ties to archived clients become memberships with access off: 0096 can put an archived and a live client of the same name on one company, and carrying the archived grant would open the live client. Creates the `client_portal_access` view, which also requires the contact to have a portal login. | Yes | Unique: one current membership per person per company; one primary per company. |
| 0106 `lead_contact_required` | Leads that still only have a typed company name (archived leads and long names, which 0090 skipped) get a company: an existing one with that name, else a new archived one. Then `leads.contact_id` becomes NOT NULL with `ON DELETE RESTRICT`, so a contact with leads can't be hard-deleted. | Yes (finds nothing the second time) | **Stops** and lists any lead with no contact. |
| 0107 `archive_and_drop_copied_fields` | Copies everything it drops into `archive_sales_tools` (below) and records any client link that didn't become a membership and any real login grant missing from the view, including a grant whose contact is archived. **Stops before dropping anything** if that list isn't empty, or if the view grants any (login, client) pair that wasn't a live `client_members` grant (drizzle rolls the whole batch back and the old tables stay). Then drops `contact_clients`, `client_members`, `contacts.company_id`, `contacts.job_title`, `companies.primary_contact_id`, and the lead copies (`contact_name`, `contact_email`, `contact_phone`, `company_name`, `company_website`). | No | **Stops** on any lost live grant (P3, P11) or any gained access; stops if an archive table already exists. |
| 0108 `drop_duplicated_data` | Drops five copies of data stored elsewhere: `client_commission_terms.closer_user_id` (superseded by the closer rows in 0086, never read since), `clients.billing_type` (billing type lives on `client_billing_terms`; the column was a cache of the newest term, so a change scheduled for next month showed at once, and readers keep that meaning; `invoices.billing_type` stays as a snapshot), `clients.origination_contact_id`, `origination_user_id`, `closer_user_id` (commission lives on `client_commission_terms` and its closer rows; the client columns were a cache of the newest term), the `contact_leads` table (`leads.contact_id` is the lead's contact), and `hour_blocks.invoice_id` (the invoice is read through `invoice_line_item_id`). Archives each first, gives a client with origination but no term one from its creation month, then **stops before dropping anything** if any value would be lost. | No | **Stops** on any client whose origination or billing type differs from its newest term, any live client with no billing term in force this month, any old term closer with no closer row on that term, any `contact_leads` row that isn't its lead's contact, or any hour block whose `invoice_id` isn't its line's invoice; stops if an archive table already exists. |
| 0109 `one_company_one_person` | Drops `clients.name` (a client's name is its company's) and `users.full_name` (a user's name is their contact's), and makes `clients.company_id` NOT NULL. Archives both columns first. Gives every live user without a contact one: linked to an unlinked live contact with the same email when exactly one matches, else a new contact named as the user was. Staff (Admin, Sales) get a membership at a **Place To Stand** company, created if missing. Clients named differently from their company show the company's name afterwards (pre-flight lists them; rename the company before release if the client's name was better). | No | **Stops** on any client with no company or any live user without exactly one live contact; stops if an archive table already exists. |
| 0110 `person_avatar` | Adds `contacts.avatar_url` (a photo belongs to the person, with or without a sign-in) and fills it from their sign-in's `users.avatar_url`. `users.avatar_url` stays and is kept in step until the sign-in table is slimmed. | Yes (re-copies the same paths) | — |
| 0111 `clients_into_companies` | Folds `clients` into `companies`: adds `slug`, `state`, `client_since`, `client_ended_at` (from the company's live client, else its most recently stopped one; `client_since` is its first client's creation, `client_ended_at` set only when no client is live), keeps every client's notes after the company's and fills a blank company website. Rewrites every `client_id` (projects, hour blocks, invoices, billing and commission terms, client updates, GitHub installs, activity targets, ids inside closed-month snapshots) to the company's id and renames the columns `company_id`; renames `client_billing_terms`, `client_commission_terms`, `client_commission_term_closers` to `billing_terms`, `commission_terms`, `commission_term_closers` (with their keys and indexes); drops `leads.converted_to_client_id` (a won lead's client is its company); drops `clients`; recreates `client_portal_access` keyed by company. Updated-at triggers stay off while ids move. Archives `clients`, `companies`, every old reference and every snapshot first, plus `client_id_map`. | No | **Stops** on a client with no company, terms that collide when two clients of one company merge, a company with two live clients, or a client with a label; stops if an archive table already exists. |
| 0112 `thin_sign_in` | Drops `users.avatar_url`: a photo is the person's (`contacts.avatar_url`, 0110). First copies any photo only the sign-in has onto its person, and archives every sign-in photo (`user_avatars_0112`). `users` is then the sign-in only: id, email, role, `disabled_at`, `deleted_at`, onboarding, timestamps. | No | **Stops** on a sign-in with a photo and no live person to carry it; stops if the archive table already exists. |

### Archives made before 0107

Both are done; neither migration has run in production, so editing them was safe. Every archive is a plain `CREATE TABLE ... AS` (no `IF NOT EXISTS`): a leftover table from an earlier attempt stops the migration instead of being reused.

- **0090** copies `leads.id, company_name` into `archive_sales_tools.lead_company_names` before it respells lead company names to match their company. The 2a/2b lead fingerprint reads `company_name` from here.
- **0097** drops `contact_clients.is_primary`, `contacts.is_champion` and `companies.client_id`. 0096 carries their meaning forward (the primary contact becomes `companies.primary_contact_id` and then a membership flag; the converted-client link becomes `clients.company_id`), but a primary flag on someone at a different company is not carried, so 0097 first copies them into `contact_clients_is_primary`, `contacts_is_champion` and `companies_client_id`.

The rehearsal (section 4) runs the whole chain from a production copy, which exercises them.

## 1. Order of steps

**Decision: one maintenance window. Migrate everything, then promote both apps immediately.**

Why not split (0089–0106, deploy, then 0107)?

- **New code can't run before 0107.** Between 0106 and 0107 it fails to create leads, because `leads.contact_name` is still NOT NULL and new code doesn't write it.
- **Old code can't run after 0105.** It keeps writing `contact_clients` and `client_members`, which the new code no longer reads. Grants changed in that gap would be lost or wrongly listed as unmapped in 0107.
- **The data is small** (tens of rows per table), so the migrations take seconds.
- **Few people are affected by a short window:** 3 portal logins and internal staff.

A split would only be worth it with a code change, making `leads.contact_name` nullable in 0106. It isn't needed at this size.

Steps:

1. **Pre-flight** (read-only; section 3). Every result should match the expected values, or be reviewed and approved.
2. **Rehearse** on a branch or snapshot (section 4) with the exact release commit. The checks in section 2 must pass.
3. **Back up.**
   - Confirm Supabase point-in-time recovery or a fresh daily backup.
   - Take an on-demand backup or `pg_dump -Fc` of production right before the window.
   - Note the timestamp.
4. **Build both apps** from the release commit as Vercel deployments, but don't promote them yet.
5. **Open the window.** Tell staff to stop editing for about 15 minutes. Portal users are few; an off-hours window is enough.
6. **Run the "before" checks** (section 2a) and save the output.
7. **Migrate.** From `packages/db`, with production's `DATABASE_URL` (Jason runs it):
   ```bash
   npm run db:migrate:prod
   ```
   - drizzle-kit can hide error text, so check the exit code is 0.
   - Confirm `select count(*) from drizzle.__drizzle_migrations` returns 108.
8. **Promote both deployments** together: internal app, then client portal.
   - **Add Dave to the Sales project** (project members) so his Sales role sees it from the first sign-in.
9. **Run the "after" checks** (section 2b) and the click-test (section 4, step 5) on production.
10. **Close the window.** Keep `archive_sales_tools` for at least one billing cycle. A later migration can drop it.

## 2. How nothing is lost

- **Backfill before drop.** 0090, 0096 and 0100–0102 only fill empty values, and 0105 builds memberships from the old tables. The only drops are 0093 (a column created in this PR) and 0097/0107/0108, which run after every backfill.
- **Archive before drop.** 0107 creates these tables in `archive_sales_tools`:
  - `contact_clients` (full copy)
  - `client_members` (full copy, including soft-deleted rows)
  - `contact_company` (contact → old `company_id`, `job_title`)
  - `company_primary_contact` (company → old `primary_contact_id`)
  - `lead_contact_copies` (lead → old name, email, phone, company name, website)
  - `unmapped_portal_access` (grants with no matching membership; **expected empty**)
  - plus `lead_company_names` (0090) and the three 0097 tables;
  - and from 0108: `commission_term_closer_users` (term → old `closer_user_id`), `client_billing_types` (client → old `billing_type`), `client_commission_columns` (client → old origination and closer columns), `contact_leads` (full copy) and `hour_block_invoices` (block → old `invoice_id`, `invoice_line_item_id`);
  - and from 0109: `client_names` (client → old `name`, company name) and `user_names` (user → old `full_name`, email, role).
- **Checks before and after.** If any check differs from expected, stop and roll back.

### 2a. Before (current production schema, read-only)

```sql
BEGIN READ ONLY;
SELECT 'contacts', count(*) FROM contacts
UNION ALL SELECT 'leads', count(*) FROM leads
UNION ALL SELECT 'clients_live', count(*) FROM clients WHERE deleted_at IS NULL
UNION ALL SELECT 'contact_clients', count(*) FROM contact_clients
UNION ALL SELECT 'client_members_active', count(*) FROM client_members WHERE deleted_at IS NULL;

-- Fingerprints, compared with the archive copies after 0107.
SELECT md5(string_agg(contact_id || ':' || client_id, ',' ORDER BY contact_id, client_id)) AS contact_clients_md5
FROM contact_clients;
SELECT md5(string_agg(user_id || ':' || client_id || ':' || coalesce(deleted_at::text, ''), ','
                      ORDER BY user_id, client_id)) AS client_members_md5
FROM client_members;
SELECT md5(string_agg(id || ':' || contact_name || ':' || coalesce(contact_email, '') || ':' ||
                      coalesce(contact_phone, '') || ':' || coalesce(company_name, ''), ','
                      ORDER BY id)) AS lead_copies_md5
FROM leads;

-- Live grants: real portal access is a login on a client (client_members),
-- live client. contact_clients is a CRM link, not access.
SELECT count(*) AS live_grants
FROM client_members cm
JOIN clients cl ON cl.id = cm.client_id AND cl.deleted_at IS NULL
WHERE cm.deleted_at IS NULL;
ROLLBACK;
```

### 2b. After (new schema)

```sql
BEGIN READ ONLY;
-- Archives are complete: same counts and fingerprints as 2a.
SELECT 'contact_clients', count(*) FROM archive_sales_tools.contact_clients
UNION ALL SELECT 'client_members', count(*) FROM archive_sales_tools.client_members
UNION ALL SELECT 'lead_copies', count(*) FROM archive_sales_tools.lead_contact_copies
UNION ALL SELECT 'lead_company_names', count(*) FROM archive_sales_tools.lead_company_names
UNION ALL SELECT 'leads', count(*) FROM leads;           -- = lead_copies = lead_company_names
SELECT md5(string_agg(contact_id || ':' || client_id, ',' ORDER BY contact_id, client_id))
FROM archive_sales_tools.contact_clients;                -- = contact_clients_md5
SELECT md5(string_agg(user_id || ':' || client_id || ':' || coalesce(deleted_at::text, ''), ','
                      ORDER BY user_id, client_id))
FROM archive_sales_tools.client_members;                 -- = client_members_md5
-- company_name comes from 0090's copy: 0090 respelled leads.company_name,
-- so the 0107 copy would not match 2a.
SELECT md5(string_agg(a.lead_id || ':' || a.contact_name || ':' || coalesce(a.contact_email, '') || ':' ||
                      coalesce(a.contact_phone, '') || ':' || coalesce(n.company_name, ''), ','
                      ORDER BY a.lead_id))
FROM archive_sales_tools.lead_contact_copies a
JOIN archive_sales_tools.lead_company_names n ON n.lead_id = a.lead_id;  -- = lead_copies_md5

-- Every client link is now a company membership, and every real login
-- grant still exists (expect 0 rows each).
SELECT 'lost client link', a.contact_id, a.client_id
FROM archive_sales_tools.contact_clients a
JOIN contacts c ON c.id = a.contact_id AND c.deleted_at IS NULL
JOIN clients cl ON cl.id = a.client_id AND cl.deleted_at IS NULL
LEFT JOIN memberships m ON m.contact_id = a.contact_id
  AND m.company_id = cl.company_id AND m.ended_at IS NULL
WHERE cl.company_id IS NOT NULL AND m.id IS NULL;
SELECT 'lost login grant', a.user_id, a.client_id
FROM archive_sales_tools.client_members a
JOIN clients cl ON cl.id = a.client_id AND cl.deleted_at IS NULL
LEFT JOIN client_portal_access v ON v.user_id = a.user_id AND v.client_id = a.client_id
WHERE a.deleted_at IS NULL AND v.client_id IS NULL;
SELECT count(*) AS unmapped FROM archive_sales_tools.unmapped_portal_access;  -- 0
-- Nobody gained access (0107 already stopped on this; expect 0 rows).
SELECT 'gained access', v.user_id, v.client_id
FROM client_portal_access v
LEFT JOIN archive_sales_tools.client_members a
  ON a.user_id = v.user_id AND a.client_id = v.client_id AND a.deleted_at IS NULL
WHERE a.user_id IS NULL;

-- Portal access did not grow: view rows should equal live_grants from 2a
-- (the real logins), not the number of client links.
SELECT count(*) AS view_rows FROM client_portal_access;

-- Memberships sanity.
SELECT count(*) AS memberships, count(*) FILTER (WHERE portal_access) AS with_access,
       count(*) FILTER (WHERE is_primary) AS primaries
FROM memberships WHERE ended_at IS NULL;

-- People in 2+ companies (expect at least the people from P1): one membership per
-- company, access as before. Review in the SQL editor; don't paste names into docs.
SELECT m.contact_id, co.name AS company, m.portal_access, m.is_primary
FROM memberships m
JOIN companies co ON co.id = m.company_id
WHERE m.ended_at IS NULL
  AND m.contact_id IN (SELECT contact_id FROM memberships WHERE ended_at IS NULL
                       GROUP BY contact_id HAVING count(*) > 1)
ORDER BY m.contact_id, co.name;

-- Leads whose displayed name now comes from a contact with a different name
-- (0096 linked them by email). For review, not an error.
SELECT count(*) AS lead_name_differs
FROM archive_sales_tools.lead_contact_copies a
JOIN leads l ON l.id = a.lead_id
JOIN contacts c ON c.id = l.contact_id
WHERE btrim(a.contact_name) <> btrim(c.name);
ROLLBACK;
```

## 3. Read-only pre-flight queries (current production schema)

Run each in the Supabase SQL editor. They only read. Put only counts and IDs in tickets or docs, not names or emails.

```sql
-- P0. Production is at 0088 (the last applied migration is 0088).
BEGIN READ ONLY;
SELECT count(*) FROM drizzle.__drizzle_migrations;
ROLLBACK;

-- P1. Contacts linked to 2+ live clients (compare with the known cases).
--     0096/0105 give each a membership at every one of those clients'
--     companies, with portal access.
BEGIN READ ONLY;
SELECT c.id, count(*) AS clients, bool_or(c.user_id IS NOT NULL) AS has_portal_login
FROM contact_clients cc
JOIN contacts c ON c.id = cc.contact_id AND c.deleted_at IS NULL
JOIN clients cl ON cl.id = cc.client_id AND cl.deleted_at IS NULL
GROUP BY c.id HAVING count(*) > 1;
ROLLBACK;

-- P2. Users with portal access to 2+ clients (expect 0).
BEGIN READ ONLY;
SELECT user_id, count(*) FROM client_members
WHERE deleted_at IS NULL GROUP BY user_id HAVING count(*) > 1;
ROLLBACK;

-- P3. Portal members with no contact (expect 0; with P11a, these are the
--     grants 0107 would stop on).
BEGIN READ ONLY;
SELECT cm.user_id, cm.client_id
FROM client_members cm
LEFT JOIN contacts c ON c.user_id = cm.user_id
WHERE cm.deleted_at IS NULL AND c.id IS NULL;
ROLLBACK;

-- P4. Portal logins without a matching contact_clients link (expect 0).
BEGIN READ ONLY;
SELECT cm.user_id, cm.client_id
FROM client_members cm
JOIN contacts c ON c.user_id = cm.user_id
LEFT JOIN contact_clients cc ON cc.contact_id = c.id AND cc.client_id = cm.client_id
WHERE cm.deleted_at IS NULL AND cc.id IS NULL;
ROLLBACK;

-- P5. Duplicate contact emails, ignoring case and spaces (expect 0).
BEGIN READ ONLY;
SELECT count(*) FROM (
  SELECT lower(btrim(email)) FROM contacts WHERE email IS NOT NULL
  GROUP BY 1 HAVING count(*) > 1) d;
ROLLBACK;

-- P6. Clients with 2+ primary contacts (expect 0).
BEGIN READ ONLY;
SELECT client_id, count(*) FROM contact_clients
WHERE is_primary GROUP BY client_id HAVING count(*) > 1;
ROLLBACK;

-- P7. Leads whose email matches no contact. 0096 creates
--     one contact per distinct email, named from that email's earliest lead.
BEGIN READ ONLY;
SELECT count(*) AS leads, count(DISTINCT lower(btrim(l.contact_email))) AS emails
FROM leads l
WHERE btrim(coalesce(l.contact_email, '')) <> ''
  AND NOT EXISTS (SELECT 1 FROM contacts c
                  WHERE lower(c.email) = lower(btrim(l.contact_email)));
ROLLBACK;

-- P8. Leads with no email. 0096 gives each a name-only contact
--     (archived if the lead is archived). Review by id.
BEGIN READ ONLY;
SELECT l.id, (l.deleted_at IS NOT NULL) AS archived
FROM leads l WHERE btrim(coalesce(l.contact_email, '')) = '';
ROLLBACK;

-- P9. Companies that will be created from lead company names (live leads,
--     <=160 chars), and how many share a name with a client (that client is
--     then linked to the same company). Then scan the name list for
--     near-duplicates ("Acme" vs "Acme Inc") to merge by hand first.
BEGIN READ ONLY;
SELECT count(DISTINCT lower(btrim(company_name))) AS lead_companies,
       count(DISTINCT lower(btrim(company_name))) FILTER (
         WHERE lower(btrim(company_name)) IN (SELECT lower(btrim(name)) FROM clients)
       ) AS shared_with_a_client
FROM leads
WHERE deleted_at IS NULL AND btrim(coalesce(company_name, '')) <> ''
  AND length(btrim(company_name)) <= 160;
SELECT lower(btrim(company_name)) FROM leads
WHERE deleted_at IS NULL AND btrim(coalesce(company_name, '')) <> ''
GROUP BY 1 ORDER BY 1;
ROLLBACK;

-- P10. Would any company end with two live clients (0104 stops)?
--      a) Live clients that share a name.
BEGIN READ ONLY;
SELECT lower(btrim(name)), count(*) FROM clients
WHERE deleted_at IS NULL GROUP BY 1 HAVING count(*) > 1;
--      b) A lead company converted to one client while another client has
--         that company's name.
SELECT lower(btrim(l.company_name)) AS company, count(DISTINCT cl.id) AS clients
FROM leads l
JOIN clients cl ON cl.deleted_at IS NULL
  AND (cl.id = l.converted_to_client_id
       OR lower(btrim(cl.name)) = lower(btrim(l.company_name)))
WHERE l.deleted_at IS NULL AND btrim(coalesce(l.company_name, '')) <> ''
GROUP BY 1 HAVING count(DISTINCT cl.id) > 1;
ROLLBACK;

-- P11. Live portal grants 0105 does not carry (expect 0 each; 0107 stops
--      on a): a) grants whose contact is archived; b) grants on archived
--      clients (not carried, by design: they could open a live client of
--      the same name).
BEGIN READ ONLY;
SELECT count(*) AS grants_archived_contact
FROM client_members cm
JOIN contacts c ON c.user_id = cm.user_id AND c.deleted_at IS NOT NULL
WHERE cm.deleted_at IS NULL;
SELECT count(*) AS grants_archived_client
FROM client_members cm
JOIN clients cl ON cl.id = cm.client_id AND cl.deleted_at IS NOT NULL
WHERE cm.deleted_at IS NULL;
ROLLBACK;

-- P12. Triggers on public tables, and whether each still fits its table.
--      A set_updated_at() trigger on a table with no updated_at column makes
--      every UPDATE on that table fail. The batch UPDATEs leads, contacts,
--      clients, companies and task_assignees (0103; it has no updated_at),
--      so any row with broken = true on those tables would abort the
--      release. Then check every function body for columns/tables this
--      batch drops.
BEGIN READ ONLY;
SELECT c.relname AS table_name, t.tgname, p.proname AS function_name,
       p.prosrc ~ 'updated_at' AS touches_updated_at,
       EXISTS (SELECT 1 FROM information_schema.columns col
               WHERE col.table_schema = 'public' AND col.table_name = c.relname
                 AND col.column_name = 'updated_at') AS has_updated_at,
       (p.prosrc ~ 'updated_at' AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns col
          WHERE col.table_schema = 'public' AND col.table_name = c.relname
            AND col.column_name = 'updated_at')) AS broken
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
ORDER BY 1, 2;
SELECT n.nspname, p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND p.prosrc ~* '(contact_clients|client_members|is_champion|is_primary|primary_contact_id|job_title|contact_name|contact_email|contact_phone|company_name|company_website)';
-- Views or rules on what 0097/0107 drop would make the DROP fail (expect 0).
SELECT DISTINCT view_schema, view_name, table_name, column_name
FROM information_schema.view_column_usage
WHERE table_schema = 'public'
  AND (table_name IN ('contact_clients', 'client_members')
       OR (table_name, column_name) IN (
         ('contacts', 'company_id'), ('contacts', 'job_title'), ('contacts', 'is_champion'),
         ('companies', 'primary_contact_id'), ('companies', 'client_id'),
         ('leads', 'contact_name'), ('leads', 'contact_email'), ('leads', 'contact_phone'),
         ('leads', 'company_name'), ('leads', 'company_website')));
ROLLBACK;
```

**Known P12 finding:** production has `activity_logs_set_updated_at` calling `set_updated_at()`, but `activity_logs` has no `updated_at` column, so any `UPDATE` on `activity_logs` fails. Nothing in 0089–0107 updates `activity_logs` (the batch never touches it) and the app only inserts and deletes there (retention prune, submission delete), which this trigger does not fire on, so the release is not affected and 0089–0107 do not drop it. Drop it in a follow-up migration (`DROP TRIGGER IF EXISTS activity_logs_set_updated_at ON activity_logs;`). Any other `broken = true` row on a table the batch updates (above) must be fixed before the window.

P13 and P14 are for 0109. They need `clients.company_id`, so run them on the rehearsal copy after 0108 and before 0109 (section 4). They are reviews, not stops.

```sql
-- P13. Clients whose name differs from their company's (after 0109 they show
-- the company's name). Rename the company before release if the client's name
-- was the better one.
SELECT cl.id, cl.name AS client_name, co.name AS company_name
FROM clients cl
LEFT JOIN companies co ON co.id = cl.company_id
WHERE cl.deleted_at IS NULL AND co.name IS DISTINCT FROM cl.name;

-- P14. Staff (Admin, Sales) and possible duplicate contacts by name: 0109
-- links a staff user to an existing contact only on an exact email match, so
-- a staff member with a contact under another email ends up with two.
SELECT u.id AS user_id, u.email AS user_email, c.id AS contact_id, c.email AS contact_email
FROM users u
JOIN contacts c ON lower(btrim(c.name)) = lower(btrim(u.full_name))
WHERE u.role IN ('ADMIN', 'SALES') AND u.deleted_at IS NULL AND c.deleted_at IS NULL
  AND (c.user_id IS NULL OR c.user_id <> u.id)
  AND lower(c.email) IS DISTINCT FROM lower(u.email);
```

Any non-empty P10 result has to be fixed in the app before release: rename, archive, or merge one of the clients. Otherwise 0104 stops the release, safely.

## 4. Rehearsal (branch or snapshot)

1. **Get a copy of production.**
   - Create a Supabase branch with production data, or restore the latest production backup into a new project.
   - Never point a rehearsal at the production project.
2. **Point at the copy only.** Set `DATABASE_URL` inline, and check the host is the branch before pressing Enter:
   ```bash
   cd packages/db && DATABASE_URL='<branch url>' npx drizzle-kit migrate; echo "exit $?"
   ```
3. **Run section 2a before** and **section 2b after**, then compare.
4. **Run both apps** locally against the branch (or as Vercel preview deployments with the branch URL).
5. **Click-test:**
   - **Company sheet:** People list shows members with title. Primary star and Save work. Adding someone already at another company keeps their other company. Removing someone ends their portal access.
   - **Client sheet:**
     - Portal access lists the company's people, and the switches save.
     - Linked company: link and unlink.
     - Invoice email recipients still default to the primary contact.
   - **Contact sheet:** Companies list, where the two P1 people each show both companies, each with title and primary star. Add company / Create. Portal access is set only on the client (Edit client > Portal access).
   - **Leads:** board cards and sheet show name, email, phone and company from the contact/company. Create a lead with a new person and a new company. Edit a lead's contact.
   - **Lead conversion:** creates a client on the lead's company, and the lead's contact gets a membership.
   - **Client portal:**
     - Sign in as a portal user and see exactly their clients.
     - A person whose access was switched off no longer sees the client.
   - **CLI/MCP:** `pts leads list`, `pts contacts get <id>` (shows `companies[]`).
6. **Time the migration** and note the exit code. Fix anything found, then rehearse again on a fresh copy.

## 5. Rollback

| When | How |
| --- | --- |
| Pre-flight fails | Nothing has changed. Fix the data in the app, then re-run pre-flight. |
| A migration fails | drizzle-orm's pg migrator runs every pending migration in **one transaction**, so a failure anywhere (including the 0104/0106/0107/0108/0109 guards) rolls back the whole batch. Confirm with P0 that production is still at 0088 (production has 90 rows: one historical migration no longer in the repo), then fix and rehearse again. |
| Problem after migrating, **before promoting** the apps | Production is on the new schema with old code. Restore the step-3 backup (preferred: no writes happened during the window), or promote the new code and fix forward. |
| Problem after promoting, within hours | **Option A, restore:** restore the step-3 backup (point in time) and promote the previous deployments of both apps. Writes made since the window are lost, so list them from `activity_logs` first. **Option B, rebuild old tables from the archive** (keeps new writes to everything else; see SQL below), then deploy a build matching the 0104 schema. |
| Later | Fix forward. The archive stays available. |

Option B SQL. Run it inside one transaction. Re-add constraints as they were in the pre-PR schema (`0000_supabase_baseline` and later).

Undo 0112 first: run [`0112-undo.sql`](0112-undo.sql) the same way. It puts `users.avatar_url` back from each person's photo (and the archive) with the updated-at trigger off. Tested on a copy: `users` comes back identical (the column returns last).

Then undo 0111: run [`0111-undo.sql`](0111-undo.sql) in one transaction (`psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f docs/migrations/0111-undo.sql`). It rebuilds `clients` from the archive, puts every `client_id` back (rows made since map to their company's client; a company first billed after the release gets a client row with the company's id), restores the snapshots, `leads.converted_to_client_id`, the company notes and websites, the old names and the view, and removes the 0111 migration row. Tested on a copy of the 0111 database: schema and every table's data come back identical (the one difference is `leads.converted_to_client_id` returning as the last column).

Then undo 0110 (tested on a copy of the production trial):

```sql
BEGIN;
ALTER TABLE contacts DROP COLUMN avatar_url;
DELETE FROM drizzle.__drizzle_migrations
WHERE id = (SELECT id FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1);
COMMIT;
```

Then undo 0109 (it puts back the client and user names; the 0108 code reads them). Tested on a copy of the production trial: every client and user name comes back as it was.

```sql
BEGIN;
-- A client gets back its own name from the archive; a client created after
-- the release takes its company's name. Updated-at triggers stay off so the
-- rollback doesn't look like an edit.
ALTER TABLE clients DISABLE TRIGGER USER;
ALTER TABLE users DISABLE TRIGGER USER;
ALTER TABLE clients ADD COLUMN name text;
UPDATE clients c SET name = coalesce(
  (SELECT a.name FROM archive_sales_tools.client_names a WHERE a.client_id = c.id),
  (SELECT co.name FROM companies co WHERE co.id = c.company_id));
ALTER TABLE clients ALTER COLUMN name SET NOT NULL;
CREATE INDEX idx_clients_name ON clients USING btree (name text_ops);
CREATE INDEX idx_clients_name_trgm ON clients USING gin (name gin_trgm_ops);
ALTER TABLE clients ALTER COLUMN company_id DROP NOT NULL;
-- A user's name is their contact's (so renames since the release are kept),
-- else the archived one.
ALTER TABLE users ADD COLUMN full_name text;
UPDATE users u SET full_name = coalesce(
  (SELECT c.name FROM contacts c WHERE c.user_id = u.id AND c.deleted_at IS NULL
   ORDER BY c.created_at LIMIT 1),
  (SELECT a.full_name FROM archive_sales_tools.user_names a WHERE a.user_id = u.id));
ALTER TABLE clients ENABLE TRIGGER USER;
ALTER TABLE users ENABLE TRIGGER USER;
-- Remove what 0109 added (staff people, their memberships, the Place To
-- Stand company: archive_sales_tools.created_0109), row by row: anything
-- made since the release that still points at one of them keeps it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT kind, id FROM archive_sales_tools.created_0109
    ORDER BY CASE kind WHEN 'membership' THEN 1 WHEN 'contact' THEN 2 ELSE 3 END LOOP
    BEGIN
      IF r.kind = 'membership' THEN DELETE FROM memberships WHERE id = r.id;
      ELSIF r.kind = 'contact' THEN DELETE FROM contacts WHERE id = r.id;
      ELSE DELETE FROM companies WHERE id = r.id;
      END IF;
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
  END LOOP;
END $$;
DELETE FROM drizzle.__drizzle_migrations
WHERE id = (SELECT id FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1);
COMMIT;
```

Then undo 0108 (it puts back the five copies; the old code reads them):

```sql
BEGIN;
ALTER TABLE clients DISABLE TRIGGER USER;
ALTER TABLE hour_blocks DISABLE TRIGGER USER;
ALTER TABLE clients ADD COLUMN origination_contact_id uuid REFERENCES contacts(id),
  ADD COLUMN origination_user_id uuid REFERENCES users(id),
  ADD COLUMN closer_user_id uuid REFERENCES users(id);
UPDATE clients c SET origination_contact_id = a.origination_contact_id,
  origination_user_id = a.origination_user_id, closer_user_id = a.closer_user_id
FROM archive_sales_tools.client_commission_columns a WHERE a.client_id = c.id;
-- Clients whose commission changed after the release: take the newest term.
UPDATE clients c SET (origination_user_id, origination_contact_id) = (
  SELECT t.origination_user_id, t.origination_contact_id FROM client_commission_terms t
  WHERE t.client_id = c.id AND t.deleted_at IS NULL ORDER BY t.effective_from DESC LIMIT 1)
WHERE EXISTS (SELECT 1 FROM client_commission_terms t
  WHERE t.client_id = c.id AND t.deleted_at IS NULL);
CREATE TABLE contact_leads (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT contact_leads_contact_lead_key UNIQUE (contact_id, lead_id)
);
INSERT INTO contact_leads SELECT id, contact_id, lead_id, created_at FROM archive_sales_tools.contact_leads;
CREATE INDEX idx_contact_leads_contact ON contact_leads USING btree (contact_id);
CREATE INDEX idx_contact_leads_lead ON contact_leads USING btree (lead_id);
INSERT INTO contact_leads (contact_id, lead_id)
SELECT l.contact_id, l.id FROM leads l
WHERE NOT EXISTS (SELECT 1 FROM contact_leads cl WHERE cl.lead_id = l.id AND cl.contact_id = l.contact_id);
ALTER TABLE client_commission_terms ADD COLUMN closer_user_id uuid REFERENCES users(id) ON DELETE RESTRICT;
UPDATE client_commission_terms t SET closer_user_id = a.closer_user_id
FROM archive_sales_tools.commission_term_closer_users a WHERE a.term_id = t.id;
ALTER TABLE clients ADD COLUMN billing_type client_billing_type NOT NULL DEFAULT 'prepaid';
UPDATE clients c SET billing_type = (SELECT t.billing_type FROM client_billing_terms t
  WHERE t.client_id = c.id AND t.deleted_at IS NULL ORDER BY t.effective_from DESC LIMIT 1)
WHERE EXISTS (SELECT 1 FROM client_billing_terms t WHERE t.client_id = c.id AND t.deleted_at IS NULL);
ALTER TABLE hour_blocks ADD COLUMN invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
UPDATE hour_blocks hb SET invoice_id = li.invoice_id
FROM invoice_line_items li WHERE li.id = hb.invoice_line_item_id;
ALTER TABLE clients ADD CONSTRAINT clients_origination_mutex CHECK ((NOT ((origination_user_id IS NOT NULL) AND (origination_contact_id IS NOT NULL))));
CREATE INDEX idx_clients_closer_user_id ON clients USING btree (closer_user_id) WHERE ((deleted_at IS NULL) AND (closer_user_id IS NOT NULL));
CREATE INDEX idx_clients_origination_contact_id ON clients USING btree (origination_contact_id) WHERE ((deleted_at IS NULL) AND (origination_contact_id IS NOT NULL));
CREATE INDEX idx_clients_origination_user_id ON clients USING btree (origination_user_id) WHERE ((deleted_at IS NULL) AND (origination_user_id IS NOT NULL));
CREATE INDEX idx_hour_blocks_invoice_id ON hour_blocks USING btree (invoice_id) WHERE ((deleted_at IS NULL) AND (invoice_id IS NOT NULL));
ALTER TABLE clients ENABLE TRIGGER USER;
ALTER TABLE hour_blocks ENABLE TRIGGER USER;
DELETE FROM drizzle.__drizzle_migrations
WHERE id = (SELECT id FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1);
COMMIT;
```

```sql
BEGIN;
-- Old link tables, from the full copies.
CREATE TABLE contact_clients (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT contact_clients_contact_client_key UNIQUE (contact_id, client_id)
);
INSERT INTO contact_clients SELECT id, contact_id, client_id, created_at FROM archive_sales_tools.contact_clients;
CREATE INDEX idx_contact_clients_client ON contact_clients USING btree (client_id);
CREATE INDEX idx_contact_clients_contact ON contact_clients USING btree (contact_id);
CREATE TABLE client_members (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT client_members_client_id_user_id_key UNIQUE (client_id, user_id)
);
INSERT INTO client_members (id, client_id, user_id, created_at, deleted_at) OVERRIDING SYSTEM VALUE
  SELECT id, client_id, user_id, created_at, deleted_at FROM archive_sales_tools.client_members;
SELECT setval(pg_get_serial_sequence('client_members', 'id'), coalesce((SELECT max(id) FROM client_members), 1));
CREATE INDEX idx_client_members_client ON client_members USING btree (client_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_client_members_user ON client_members USING btree (user_id) WHERE (deleted_at IS NULL);

-- Dropped columns.
ALTER TABLE contacts ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
                     ADD COLUMN job_title text;
UPDATE contacts c SET company_id = a.company_id, job_title = a.job_title
FROM archive_sales_tools.contact_company a WHERE a.contact_id = c.id;
CREATE INDEX idx_contacts_company ON contacts USING btree (company_id) WHERE ((deleted_at IS NULL) AND (company_id IS NOT NULL));
ALTER TABLE companies ADD COLUMN primary_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;
UPDATE companies co SET primary_contact_id = a.primary_contact_id
FROM archive_sales_tools.company_primary_contact a WHERE a.company_id = co.id;
ALTER TABLE leads ADD COLUMN contact_name text, ADD COLUMN contact_email text,
  ADD COLUMN contact_phone text, ADD COLUMN company_name text, ADD COLUMN company_website text;
UPDATE leads l SET contact_name = a.contact_name, contact_email = a.contact_email,
  contact_phone = a.contact_phone, company_name = a.company_name, company_website = a.company_website
FROM archive_sales_tools.lead_contact_copies a WHERE a.lead_id = l.id;
-- Leads created after the release have no copy: fill from their contact.
UPDATE leads l SET contact_name = c.name, contact_email = c.email, contact_phone = c.phone
FROM contacts c WHERE c.id = l.contact_id AND l.contact_name IS NULL;
UPDATE leads l SET company_name = co.name, company_website = co.website
FROM companies co WHERE co.id = l.company_id AND l.company_name IS NULL;
ALTER TABLE leads ALTER COLUMN contact_name SET NOT NULL;

-- Undo 0105-0107 and tell drizzle.
DROP VIEW client_portal_access;
DROP TABLE memberships;
ALTER TABLE leads ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE leads DROP CONSTRAINT leads_contact_id_fkey,
  ADD CONSTRAINT leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
-- 0106 gave leads with only a typed company name a company: undo that.
UPDATE leads l SET company_id = NULL FROM archive_sales_tools.lead_companies_0106 a WHERE a.lead_id = l.id;
-- Remove those companies unless something made since the release uses them
-- (a lead's company would otherwise be cleared without an error).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.id FROM archive_sales_tools.companies_created_0106 c
    WHERE NOT EXISTS (SELECT 1 FROM leads l WHERE l.company_id = c.id) LOOP
    BEGIN DELETE FROM companies WHERE id = r.id; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  END LOOP;
END $$;
DELETE FROM drizzle.__drizzle_migrations
WHERE id IN (SELECT id FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 3);
COMMIT;
```

Memberships made through the app after the release, such as new access grants, are not carried back by Option B. Re-apply them by hand from `activity_logs`. Option B returns the database to the 0104 shape. Rehearsed on a copy of production: after the whole batch (0089–0112), the undo steps above return it to exactly the state of the same copy migrated to 0104, schema and data (`node scripts/compare-rollout.mjs` covers the forward run). Going all the way back to production's current code means Option A.

## 6. Decisions for Jason, and who does what

Approve:

1. ~~Amend 0097 with archive statements~~ **Done:** 0097 archives its three columns and 0090 archives lead company names (see [Archives made before 0107](#archives-made-before-0107)).
2. Use the single maintenance window approach and pick a time (off-hours, about 15 minutes).
3. Pre-flight results (section 3), in particular:
   - P1: the two people at two companies each get memberships at both, with portal access carried over.
   - P8: the 7 leads with no email become name-only contacts.
   - P9: the companies that will be created from lead names. Merge near-duplicates first if you want them as one company.
   - P10: any client name collisions.
4. After rehearsal: the `lead_name_differs` count, where a lead now shows its linked contact's name.
5. How long to keep `archive_sales_tools` (suggested: until the next monthly close is done).
6. Which backup is the restore point (point-in-time or on-demand).

| Who | Does |
| --- | --- |
| Jason | Approves the items above. Owns production credentials. Runs `npm run db:migrate:prod` and promotes the deployments. Chooses the window. |
| Claude (local) | Keeps the plan and SQL current. Rehearses on a branch only when given that branch's URL. Never writes to production. Runs read-only checks only when Jason allows it. |
| Either | Click-test checklist on the branch, then on production right after promotion. |
