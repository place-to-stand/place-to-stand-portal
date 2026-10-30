# One company, one person (PR #279, migration 0109)

Goal: two records a person deals with. A **company** is any business; a
company you bill is a *client* (a state, shown as a "Client" badge). A
**person** is anyone (stored in `contacts`); a person who can sign in has a
*sign-in* with a role (Admin, Sales, Client). Anything about a business lives
on the company; anything about a person lives on the person. The UI says
Companies and People; tables, URLs kept for old links, and CLI fields keep
the `contact` name (the API is a contract: fields are added, not renamed). Nothing here runs against
production; it ships with the rest of the unreleased batch (0089–0109).

## Schema end state

### Company and client

- `companies` stays the record for every business (name, website, people).
- `clients` stays, but only as the company's **billing record**: one per
  company, `company_id` NOT NULL and unique while live (already enforced by
  `clients_company_id_live_key`). It keeps what is about billing: `slug` (URLs),
  `state` (sales tax), `notes` (billing notes), `label`, plus everything keyed
  on `client_id` (projects, invoices, hour blocks, billing and commission
  terms, portal access, GitHub installs, client updates, monthly close).
- **Dropped:** `clients.name`. A client's name is its company's name.

Why not move the billing columns onto `companies` and repoint every
`client_id` to `company_id`? Projects, invoices, hour blocks, both term
tables, the portal access view, the monthly close and the CLI all key on
`client_id`; repointing them is a large, risky migration with no visible
difference. Keeping the billing record 1:1 and hiding it in the UI gives the
same experience with a fraction of the change.

### Contact and user

- `contacts` is the person: name, email, phone, LinkedIn, companies.
- `users` stays, but only as the **sign-in**: id (the auth id), sign-in
  email, role, `disabled_at` (the emergency off switch), `deleted_at`,
  onboarding, and the photo the person uploads (`avatar_url`, shown on the
  contact). A user hangs off exactly one contact (`contacts.user_id`, already
  unique).
- **Dropped:** `users.full_name`. A person's name is their contact's name.
- The sign-in email stays on `users` (the auth provider needs it). It can
  differ from the contact's email; the contact sheet shows both when they do.

### Staff

Staff users (Admin, Sales) have no contact today. 0109
gives each one a contact at a new **Place To Stand** company (title
"Partner" or "Sales"). A staff contact is linked to an existing contact only
on an exact email match. A staff member who also has a contact under a
different email is not merged automatically: the pre-flight lists likely
duplicates by name to decide by hand.

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

- **Company sheet:** a Client section for admins with the billing record's
  Billing (type, state), Commission and Portal access, saved by the
  company's Save; "Client page" and "Stop billing" sit on its title row.
  Without a client it offers **Make client** (`?client=new`, company
  preselected). Link / unlink client are gone. `?client=<id>` links open the
  company sheet.
- **Client page** (`/clients/[slug]`) stays for projects, notes and updates;
  its Edit opens the company sheet and its breadcrumbs sit under Companies.
- **Companies list:** a "Client" badge column and the "Clients" filter.
  Clients leaves the sidebar; `/clients` redirects to Companies filtered to
  clients. `/clients/archive` (stopped billing) stays reachable.
- **Person sheet:** a Sign-in section for admins: sign-in email, last
  sign-in, role (Admin, Sales, Client), Can sign in (the off switch), set a
  temporary password (forces a reset), archive / restore. Each applies right
  away. "Create sign-in" when there is none.
- **Archiving a person** switches their sign-in off in the same transaction,
  then bans the auth account and revokes connections.
- **Settings > Users** redirects to People filtered to sign-ins
  (`?signIn=`, admins only); `?user=<id>` opens the person.
- **Lead conversion** = Make client: the client takes the company's name;
  if the company is already a client the lead links to it.
- **People:** `/contacts` redirects to `/people`.
- Sales never sees billing, hours or sign-in controls (UI gated on admin,
  server actions require ADMIN).

## Checks

- 0109 on a fresh copy of the production trial database and on the local
  copy; guard tested with bad data; undo SQL tested.
- Monthly close for October unchanged: $5,200 billing in, $4,462.50 payouts.
- Client portal: sign-in, project list, profile rename.
- Type-check and lint.
