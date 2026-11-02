# One company, one person (PR #279, migration 0109)

Goal: two records a person deals with. A **company** is any business; a
company you bill is a *client* (a state, shown as a "Client" badge). A
**person** is anyone (stored in `contacts`); a person who can sign in has a
*sign-in* with a role (Admin, Sales, Client). Anything about a business lives
on the company; anything about a person lives on the person. The UI says
Companies and People; tables, URLs kept for old links, and CLI fields keep
the `contact` name (the API is a contract: fields are added, not renamed). Nothing here runs against
production; it ships with the rest of the unreleased batch (0089–0109).

## Schema end state (after 0111 and 0112)

- `companies` is every business. A company you bill is a client: `client_since` set and `client_ended_at` null (a former client has both). It carries the billing bits that used to be on `clients`: `slug` (project URLs) and `state` (sales tax). Everything billed keys on `company_id`: projects, hour blocks, invoices, `billing_terms`, `commission_terms` (+ `commission_term_closers`), client updates, GitHub installs. There is no `clients` table (0111).
- `contacts` is the person (UI: People): name, email, phone, LinkedIn, photo (`avatar_url`), companies through `memberships`.
- `users` is only the sign-in: auth id, sign-in email (always the person's email), role, `disabled_at`, `deleted_at`, onboarding. Name and photo are read from the person (`personNameSql`, `personAvatarSql`). Each sign-in has exactly one person (`contacts.user_id`).
- Staff (Admin, Sales) are people at the **Place To Stand** company.
- Staying on `users` (decided Oct 30): the 38 foreign keys that record which sign-in acted or owns something (created_by, author, assignee, owner, time logs, commission closers and origination).

The sections below record how it got there: 0109 first kept `clients` as a billing record; 0111 then folded it into companies.

## Migration 0109

1. Archive `clients.name` (with its company's name) and `users.full_name`
   into `archive_sales_tools`.
2. Create the Place To Stand company if missing; give each live user without
   a contact one (staff at Place To Stand; a portal user without a contact,
   if any, as a contact with no company).
3. Guard (stop the batch before any drop):
   - any client without a company;
   - any live user without exactly one live contact;
   - any contact whose name is blank where its user had a name (would lose
     the name).
4. Drop `clients.name` and `users.full_name`.

**Name changes to check first:** some clients are named differently from
their company (for example a client named after a person under a company
named for the business). After 0109 they show the company's name; the
pre-flight lists them.
Rename the company before release if the client's name was the better one;
the old names stay in the archive.

Undo SQL goes in `sales-tools-rollout.md` with the rest of the batch.

## Code

- One reader per name: `clientNameSql()` (the company's name for a client)
  and `personNameSql()` (the contact's name for a user) replace direct reads
  of `clients.name` and `users.full_name`. CLI and MCP fields keep their
  names (`client.name`, `user.fullName`); only their source changes.
- Writers: renaming happens on the company or the person only (renaming a
  user renames their contact). The client portal has no profile rename.
- The UI calls contacts **People** (sidebar, titles, buttons, empty states,
  ⌘K, activity). `/contacts` links redirect to `/people`.

## UI (built)

- **Company sheet:** tabs Details · People · Projects · Billing. Billing has one "Bill this company" switch (make, stop, restart), billing type, state and commission, saved with the sheet's one Save. Each People row has the person's Portal switch.
- **Person sheet:** one stacked form: photo, details, companies, and Sign-in ("Can sign in" plus a role, saved with Save; "Send password reset" stays instant). The email is the sign-in. Create and edit are the same sheet: an admin can give a new person a sign-in in the same Save. Save is one server action (`savePersonSheetAction`) and one transaction: Supabase Auth steps (create the auth user, change its email, ban/unban) and the staged photo move run first and are undone if the transaction fails; activity (including sign-in created, role, on/off and email changes) is logged after commit. A role change asks which month it starts (this month by default; back to Oct 2025 unless a closed month is in the way; or next month, which `users.role` picks up on the 1st via the `apply-role-terms` cron or at sign-in). Becoming Admin/Sales joins the staff company (`is_staff`) with no title; becoming Client leaves it. People with a sign-in are editable by admins only; Sales see their fields read-only, and never see sign-ins or portal access (sheet, People list, contacts MCP/CLI).
- **Lists:** Companies (with the Client badge and Clients / Former clients filters) and People (sign-in column for admins). `/clients/*`, `/contacts/*` and `/settings/users` only redirect, for old bookmarks; the app never links to them.
- **Leads:** a lead's person and company are records; a person who isn't at the company shows a warning with "Add to <company>"; billing a won lead's company happens on that company.
- Sales never sees billing, hours, portal or sign-in controls.

## Checks

- 0109 on a fresh copy of the production trial database and on the local
  copy; guard tested with bad data; undo SQL tested.
- Monthly close for October unchanged: $5,200 billing in, $4,462.50 payouts.
- Client portal: sign-in, project list, profile rename.
- Type-check and lint.

## Audit of the company and person screens (step 1)

Each piece was checked for: does it belong to this record, is it in the
right place, is there a second way to do the same job, is it left over from
the client/user split, does the wording name the entity.

| Component | Problem | Fix |
| --- | --- | --- |
| Company sheet: Make client | A separate sheet popped over the company sheet | "Bill this company" switch on the Billing tab; fields inline; saved with Save |
| Company sheet: ⋯ menu | Make client / Stop billing duplicated the Billing tab | Removed |
| Company sheet: stacked Client section | Nested "Billing" inside "Client"; long sheet | Tabs: Details, People, Projects, Billing; outer heading "Client" |
| Company sheet: Portal access list | Second list of the same people | A Portal switch on each People row; only "access outside this company" rows stay on Billing |
| Company People rows: Create sign-in | Second way to create a sign-in | Removed: sign-ins are created on the person |
| Company sheet: Link client / Link company | Leftover from the split | Removed |
| Client page (`/clients/<slug>`) | Duplicated the company | Removed; redirects to the company on Projects. Projects and updates → Projects tab; hours → Billing tab; notes → company notes (merged in 0111) |
| Clients list, archive, activity | Duplicated Companies | Redirect to Companies (Clients / Former clients filters) and company activity |
| Lead: Convert dialog | Second way to make a client; asked for a client name and slug | Removed; "Make client" opens the company's Billing tab; won leads link to the client automatically |
| Person: avatar on the sign-in | The photo belongs to the person | `contacts.avatar_url` (0110); upload for anyone at the top of the sheet |
| Person: "photo once they have a sign-in" hint | Pointed somewhere else | Removed |
| Person sheet tabs | Too little to need tabs | One stacked form: photo, Details, Companies, Sign-in |
| Person: sign-in email field | A second email | One email: the login follows the person's email (admins only change it) |
| Person: temporary password | Clumsy | "Send password reset" |
| Person: Archive sign-in, Create sign-in pop-over, ⋯ item, People row action | Several ways to switch sign-in | One "Can sign in" switch plus a Role picker, saved with Save; archiving the person switches it off |
| Person Companies rows: portal tooltip | Pointed to another screen | Read-only "Portal access" note |
| People list: "User" column | Word "user"; photo only for sign-ins | Photo beside every name; "Sign-in" column with the role (admins) |
| Settings > Users page and sheet ("Linked contact", "Open contact") | Leftover from the split | Removed; redirects to People (sign-ins) and the person |
| Client badge / filters / Billing state | Same icon as the company | Client is the briefcase, company the building, person the user icon, in the palette B colours from the entity registry |

Kept on purpose:
`users` until 0112; Gmail client helpers and generated Supabase types (not
part of the split).

## Migration 0111: clients into companies (built)

A client is a company you bill, so the separate billing record is gone:

- `companies` gains `slug` (project URLs), `state` (sales tax), `client_since` and `client_ended_at`. A company is a client while `client_since` is set and `client_ended_at` is not; a former client has both. Helpers: `isClientCompany()`, `wasClientCompany()` and `clientEndedAtSql` in `@pts/db/client-state`.
- Every `client_id` is `company_id` (projects, hour blocks, invoices, terms, client updates, GitHub installs, activity); the term tables are `billing_terms`, `commission_terms`, `commission_term_closers`.
- Making a company a client sets `client_since` and a slug; stopping billing sets `client_ended_at`; restarting clears it.
- CLI and MCP: `clientId` stays in every response as an alias with the company's id, beside a new `companyId`. Old client ids are accepted for good through `archive_sales_tools.client_id_map` (`lib/queries/legacy-client-ids.ts`), which is kept permanently.
- Undo: `docs/migrations/0111-undo.sql`, described in `sales-tools-rollout.md`.

Still named "client" on purpose: the client portal, `client_portal_access`, `client_updates`, and code that means the company in its client role (the billed party on an invoice, hours by client). Renaming those identifiers is a follow-up.

## Migration 0112: the sign-in is only a sign-in (built)

- `users.avatar_url` is gone: a photo is the person's. Read it with `personAvatarSql` / `personAvatarOf()` from `@pts/db/names` (as names use `personNameSql`). Profile and person photo uploads write `contacts.avatar_url` only; deleting a sign-in leaves the photo.
- The user services lost their photo handling (no caller passed one).
- `users` keeps id, email, role, `disabled_at`, `deleted_at`, onboarding and timestamps.
- The 38 foreign keys that point at `users` (created_by, author, actor, assignee, owner, time logs, commission) stay there: they record which sign-in acted (decided Oct 30).
