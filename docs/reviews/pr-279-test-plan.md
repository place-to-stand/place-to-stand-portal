# PR #279 test plan (hands-on)

Test on **http://localhost:3003** (internal) and **http://localhost:3011** (client portal), both on the local production copy with email and outside calls blocked. Nothing you do there reaches production or sends email.

**MUST** = money or permissions; test these before release. Work top to bottom: the most important come first in each section.

Sign in as yourself (Admin). For Sales checks, sign in as the Sales test user (`dave@local.test`) in a private window. For the client portal, use **Preview as** from the internal app (Companies › a client › People, or the portal's admin preview).

---

## 1. Monthly close and payroll

1. **MUST** Reports › Monthly close › **September 2026**. Expect: Billing in $15,850.00, payouts $14,657.50, and no "drift" warning against the saved close.
2. **MUST** Step back month by month to **October 2025**. Expect: every closed month shows no drift warning (its saved snapshot matches).
3. **MUST** **October 2026** (open). Expect: billing in $5,200.00 and payouts in line with time logged this month.
4. **MUST** Payroll rows: only people who were **Admin** in that month appear, with their hours on client projects. Sales hours never appear.
5. Open a closed month that included someone since archived (if any). Expect: they still appear in that month's payroll.

## 2. Companies and billing

1. **MUST** Companies › **Create company**. Expect: all four tabs (Details, People, Projects, Billing) on create. Add a name, add a person on People, switch **Bill this company** on with "This month", Save once. Expect: one save, sheet closes, the company shows the **Client** badge, the person is on its People tab.
2. **MUST** Open that client › Billing › switch billing **off** › choose **Bill through the end of this month** › Save. Expect: still a Client this month; Billing tab says "Billing stops after October 2026". Activity says "Stopped billing … (last month billed: October 2026)".
3. **MUST** Same company › switch billing **on** › Save. Expect: the scheduled stop is cancelled; activity says "Kept billing … (cancelled the scheduled stop)".
4. **MUST** Stop billing with **Stop now** › Save. Expect: no longer a Client (badge gone, listed as former client); it disappears from this month's Billing in.
5. **MUST** Restart that former client › Save. Expect: Client again; activity "Restarted billing … (from …)".
6. **MUST** Change a client's **billing type** (Prepaid ↔ Net 30) with "Next month". Expect: this month's close unchanged; next month uses the new type.
7. **MUST** Change **commission** (origination or closers) with "This month". Expect: this month's close pays the new people.
8. Try starting billing "This month" while this month is closed (only if you have a closed current month to test with). Expect: refused with the closed-month message.
9. Archive a non-client company, then restore it. Expect: both work; nothing about billing changes.
10. ⌘K, type part of a company name. Expect: a **Companies** group; billed companies show a **Client** badge; Enter opens the company sheet.

## 3. People, sign-ins and roles

1. **MUST** Create a person with **Can sign in** on, role **Client**, Save once. Expect: one save; their sign-in exists (role Client). (No email leaves this machine.)
2. **MUST** Open an existing **Sales** person. Expect: "Can sign in" **on** and role **Sales** shown correctly (not "off / Client"). No "Role starts" field until you change the role.
3. **MUST** Change that role to **Admin**. Expect: a **Role starts** month picker appears, defaulting to this month. Close without saving: "Discard changes?".
4. **MUST** Change a role with **next month** and save. Expect: the sheet says "Becomes Admin from November 2026"; today they keep their current role.
5. **MUST** Turn a person's sign-in **off** and save; try signing in as them. Expect: refused. Turn it back on: works.
6. Change a person's sign-in email and save. Expect: they sign in with the new email.
7. A person who becomes staff (Admin/Sales) joins **Place To Stand** automatically; one changed to Client leaves it.
8. Archive a person who has no sign-in, then restore them.

## 4. Sales role (sign in as Sales)

1. **MUST** People › open **an admin** (or anyone with a sign-in). Expect: fields read-only, note "Only an admin can edit someone who can sign in.", no Sign-in section, no portal access.
2. **MUST** People list and a person sheet: no Sign-in or Portal access columns or fields anywhere.
3. **MUST** Companies › open a **client**. Expect: no Billing tab content you can change, no portal switches, no billing figures.
4. **MUST** Company and People activity feeds: no "billing started/stopped", portal-access or portal-invite events.
5. **MUST** Try to archive **Place To Stand** or remove someone from it. Expect: refused.
6. **MUST** Open a lead whose person has a sign-in (e.g. an admin's email) and change the name/phone. Expect: the lead saves but the person's name/phone is **not** changed.
7. Leads: create and move leads; dragging to **Won** without a company is refused.
8. Sidebar shows only the CRM (leads, people, companies, plus Home/Tasks and their projects).

## 5. Client portal (Preview as a client person, then on :3011)

1. **MUST** Preview as a person with portal access at a client. Expect: only that company's projects, hours and invoices.
2. **MUST** Preview as a person at **two** clients. Expect: both companies, nothing else.
3. **MUST** A person whose company's billing was stopped **now**: no portal access. One billed **through this month**: check the current behaviour matches the decision on portal access (see audit decisions).
4. Empty states read "Your portal isn't set up yet…" and the admin preview says "Choose a person to preview".
5. Invoices page: "Show all companies"; an invoice opens and its PDF downloads.

## 6. Leads

1. **MUST** Mark a lead **Won** in the sheet without a company. Expect: refused on the Company field. With a company: saves, and as Admin you land on that company's **Billing** tab.
2. Create a lead (same two-column sheet as edit); Tasks and Updates show "after you save" lines on create.
3. Add, edit and delete a lead update (instant).
4. Drag a lead between columns, including to Won with a company.

## 7. Tasks and projects

1. **MUST** Create a task with an assignee and an attachment, Save once. Expect: one save; the assignee and file are there.
2. Open a task's **Planning** panel. Expect: nothing is created just by opening; "Start planning" creates it.
3. Comments: add, edit, delete (instant).
4. Create a project with a member, Save once. Reopen it. Expect: the member is listed (this was broken before).
5. Projects list: client rows have a softer green band; project owner links to their person on the project overview.

## 8. Invoices, hour blocks and time logs

1. **MUST** Edit a **draft** invoice without saving. Expect: **Send to client** and **Mark as sent** are disabled with "Save your changes before sending." Save, then they work.
2. **MUST** Create an hour block for a client; it appears in that month's close (prepaid Billing in).
3. **MUST** Try to create a client project, hour block or invoice for a company that isn't a client. Expect: refused ("That company isn't a client…").
4. Log time from a task (dialog), edit and delete it.
5. Closed-month warnings on time logs and hour blocks show as **amber warning** toasts, not red.

## 9. Design changes (quick look)

1. Toasts: success (green check), error (red title, light red wash), warning (amber), info.
2. Alerts: the warning icon is centred on the first line, also when text wraps.
3. Badges: all the same size and weight, sentence case (lead stages are no longer ALL CAPS).
4. Pickers open on the selected option; scroll and hover never snap back.
5. Popovers and menus have the stronger shadow; in dark mode a lighter panel with a faint edge.
6. Entity colours: money green (Client green, Invoice teal, Hour block lime), work blue (Project blue, Task indigo, Time log sky).
7. /design: Patterns (one Save, related records stack, create = edit), Badges (two looks), Shadow scale (shadow-popover).

## 10. Release-day checks (before promoting)

1. Take the release backup and a fresh read-only dump with the **direct** connection (not the pooler: port 5432, no `?pgbouncer`). From your terminal (prints nothing secret):

   ```
   (set -a; . ~/Sites/place-to-stand-portal/apps/internal/.env.prod; set +a; U="${DATABASE_URL%%\?*}"; U="${U/:6543\//:5432/}"; pg_dump "$U" -Fc -n public -n drizzle -n auth -f ~/Backups/pts-portal/prod-$(date +%Y%m%d-%H%M).dump) && ls -la ~/Backups/pts-portal/prod-*.dump
   ```
2. Run `scripts/rehearse-rollout.sh <dump>`. Expect: 41/41 compare checks, ALL CHECKS PASS (verify), close drift none, undo differences 0.
3. Check nobody was stopped as a client earlier in the release month (a stop dated this month counts as billed through the month after the migration).
4. Confirm `CRON_SECRET` is set in Vercel (new daily `/api/cron/apply-role-terms`).
