# PR #279 test plan (hands-on)

Test on **http://localhost:3003** (internal) and **http://localhost:3011** (client portal). Both run on the local production copy with email and outside calls blocked, so nothing you do there reaches production or sends email.

**MUST** = money, permissions or security; test these before release. Within each section the most important checks come first.

**Who to sign in as:**

- **Admin:** yourself.
- **Sales checks:** the Sales test user (`dave@local.test`) in a private window.
- **Client portal:** use **Preview as** from the internal app (Companies › a client › People), or the portal's admin preview.

What changed in the audit and why: [pr-279-swarm-audit.md](pr-279-swarm-audit.md).

---

## 1. Monthly close and payroll

1. **MUST** Reports › Monthly close › **September 2026**. Expect:
   - billing in $15,850.00;
   - payouts $14,657.50;
   - no "drift" warning against the saved close.
2. **MUST** Step back month by month to **October 2025**. Expect: no closed month shows a drift warning.
3. **MUST** **October 2026** (open). Expect:
   - billing in $5,200.00;
   - payouts in line with the time logged this month.
4. **MUST** Payroll rows list only people who were **Admin** in that month, with their hours on client projects. Sales hours never appear.
5. **MUST** Home dashboard hours widget: prepaid hours this month match the close's prepaid figure.
6. A closed month that included someone since archived: they still appear in that month's payroll.

## 2. Companies and billing

1. **MUST** Companies › **Create company**. Expect: Details, People and Billing tabs (no Projects tab on create).
   - Add a name and a person.
   - Switch **Bill this company** on with "First month billed: October 2026 (this month)".
   - Save once.
   - Expect: one save, the sheet closes, a **Client** badge, and the person on its People tab.
2. **MUST** Open that client › Billing. Switch billing **off**. The picker reads **Last month billed** with "October 2026 (this month)" first. Keep it and Save. Expect:
   - still a Client;
   - Billing tab says "Billing stops after October 2026";
   - activity says "Stopped billing … (last month billed: October 2026)".
3. **MUST** Same company: switch billing **on** › Save. Expect:
   - the stop is cancelled;
   - activity says "Kept billing … (cancelled the scheduled stop)".
4. **MUST** Stop billing with **"September 2026 (last month)"** › Save. Expect:
   - no longer a Client;
   - listed as a former client;
   - gone from this month's Billing in.
5. **MUST** Restart that former client › Save. Expect: Client again, and activity "Restarted billing … (from …)".
6. **MUST** Change a client's **billing type** with next month. Expect:
   - the note reads "October stays …; the new type starts in November.";
   - this month's close is unchanged.
7. **MUST** Change **commission** with this month. Expect:
   - the note reads "October's close pays the new people.";
   - the close pays them.
8. **MUST** Start billing a non-client with **"November 2026 (next month)"**. Expect: the line says "Their people can use the portal now."
9. **MUST** Billing tab wording: a section titled **Terms** and a field **Tax state**.
10. Client › **Projects** tab:
    - its projects are listed with the same status badge as elsewhere;
    - **Create project** opens the project sheet with the client filled in;
    - saving it adds the project to the tab.
11. A company that was never billed has no Projects tab.
12. Archive a non-client company, then restore it. The confirm reads "Archive company?". Both work.
13. ⌘K, type part of a company name. Expect:
    - a **Companies** group;
    - billed companies show a **Client** badge;
    - Enter opens the company sheet.

## 3. People, sign-ins and roles

1. **MUST** Create a person with **Can sign in** on, role **Client**. Save once. Expect: one save, and their sign-in exists with role Client.
2. **MUST** Open an existing **Sales** person. Expect:
   - "Can sign in" is on, with role Sales;
   - no "Role starts" picker until you change the role.
3. **MUST** Change that role to **Admin**. Expect:
   - a **Role starts** month picker appears, styled like the billing month picker, defaulting to this month;
   - closing without saving asks "Discard changes?".
4. **MUST** Change a role with next month and save. Expect:
   - "Becomes Admin from November 2026";
   - today they keep their current role.
5. **MUST** Turn a person's sign-in **off** and save, then try to sign in as them: refused. Turn it on again: they can sign in.
6. **MUST** Give a sign-in to an email that already had an auth account. Expect: the old password no longer works, and they must reset. (S1: an attacker can no longer pre-register a staff or client email.)
7. Change a person's sign-in email and save. Expect: they sign in with the new email.
8. People list › company filter says **All companies** and lists every company:
   - picking a client shows its portal people;
   - picking a prospect shows who works there.
9. A person who becomes staff (Admin or Sales) joins **Place To Stand**; one changed to Client leaves it.
10. Archive a person without a sign-in, then restore them.

## 4. Sales role (sign in as Sales)

1. **MUST** People › open an admin, or anyone with a sign-in. Expect:
   - fields read-only;
   - "Only an admin can edit someone who can sign in.";
   - no Sign-in section.
2. **MUST** People list and person sheet: no Sign-in or Portal access columns or fields.
3. **MUST** Companies › a client: no billing controls, portal switches or billing figures.
4. **MUST** Company and People activity: no billing, portal-access or portal-invite events.
5. **MUST** Companies list › **Place To Stand**:
   - the archive button is disabled, with "Only an admin can change Place To Stand.";
   - renaming it in the sheet is refused.
6. **MUST** Open a lead whose person has a sign-in (an admin's email). Change the name or phone and save. Expect: the lead saves, but the person's name and phone are unchanged.
7. **MUST** Try to archive a client's primary contact: refused.
8. Leads: create and move leads; a Won drag without a company opens the lead with the error on Company.
9. The sidebar shows only the CRM: leads, people, companies, plus Home, Tasks and their projects.

## 5. Client portal (Preview as a client person, then on :3011)

1. **MUST** Preview as a person with portal access at a client. Expect: only that company's projects, hours and invoices.
2. **MUST** Preview as a person at **two** clients. Expect: both companies, nothing else.
3. **MUST** A person at a company stopped with "last month": no portal access.
   - For one billed through this month, access is cut today: decision **P1** in the audit.
4. Empty states:
   - the portal says "Your portal isn't set up yet…";
   - the preview says "Choose a person to preview" (once, not twice).
5. Invoices page: "Show all companies"; an invoice opens and its PDF downloads.
6. An unknown or malformed id in a portal URL shows a not-found or 400, not an error page.

## 6. Leads

1. **MUST** As Admin, drag a lead with a company to **Won** on the board. Expect: the company opens on its **Billing** tab.
2. **MUST** Drag a lead **without** a company to Won. Expect: the move is refused and the lead opens with "Add the lead's company…" on the Company field.
3. **MUST** Mark a lead Won in the sheet without a company: refused on Company. With a company: saves and lands on Billing.
4. Create a lead: the sheet is titled "Create lead"; Tasks and Updates show "Add … after you save the lead". Edit it: titled with the person's name and the lead icon.
5. Add, edit and delete a lead update (each saves at once).
6. Archive a lead: the confirm reads "Archive lead?" … "Its history stays."

## 7. Tasks and projects

1. **MUST** Create a task with an assignee and an attachment. Save once. Expect: one save, with the assignee and file there.
2. **MUST** Attach an `.html` or `.svg` file to a task and open it. Expect: it downloads, never renders in the browser (S4). Images and PDFs still preview.
3. Open a task's **Planning** panel: nothing is created until you click "Start planning".
4. Comments: add, edit and delete (each saves at once).
5. Create a project with a member, Save once, reopen it: the member is listed.
6. Project overview: the owner links to their person.
7. Archive a project: the confirm reads "Archive project?". Edit sheets are titled with the project's name.

## 8. Invoices, hour blocks and time logs

1. **MUST** Edit a **draft** invoice without saving. Expect: **Send to client** and **Mark as sent** are disabled ("Save your changes before sending."). Save, and they work.
2. **MUST** Create an hour block for a client: it appears in that month's close (prepaid Billing in).
3. **MUST** Try to create a client project, hour block or invoice for a company that isn't a client: refused ("That company isn't a client…").
4. **MUST (staging with Stripe test keys; Stripe is blocked locally):**
   - Open a sent invoice's pay link, then raise its total in the app.
   - Pay from the old tab. Expect: checkout charges the **new** total.
   - A payment short of the total never marks the invoice paid (S5).
5. An hour block's invoice row opens the invoice sheet on top.
6. Log time from a task (dialog), then edit and delete it.
7. Closed-month warnings on time logs and hour blocks show as **amber** warnings.

## 9. Security quick checks

1. **MUST** Visit `http://localhost:3003/sign-in?redirect=/%5Cexample.com` and sign in. Expect: you land on the portal home, not example.com (S3). Repeat on :3011.
2. **MUST** Profile › change your photo. Expect: it works.
   - A crafted request naming someone else's photo path is refused ("Upload the photo again.").
   - This is covered by code review; try it only if you're curious.
3. Rich text (comments, lead updates): pasting `<img src=x onerror=alert(1)>` shows as text, with no alert.

## 10. Design changes (quick look)

1. Toasts: success has a green check; error has a red title on a light red wash; warning is amber; info is neutral.
2. Alerts: the warning icon is centred on the first line, also when the text wraps.
3. Badges: all the same size and weight, sentence case. Project status badges look the same everywhere.
4. Pickers open on the selected option; scrolling and hovering never snap back. Staff pickers say "Search people…" with a **Staff** group.
5. Popovers and menus have the stronger shadow.
6. Entity colours: money is green (Client green, Invoice teal, Hour block lime); work is blue (Project blue, Task indigo, Time log sky).
7. Sheets: edit titles are the record's name with its icon; empty sections use the shared empty state.

## 11. Release-day checks (before promoting)

1. Take the release backup: a fresh read-only dump over the **direct** connection (port 5432, no `?pgbouncer`). From your terminal (prints nothing secret):

   ```
   (set -a; . ~/Sites/place-to-stand-portal/apps/internal/.env.prod; set +a; U="${DATABASE_URL%%\?*}"; U="${U/:6543\//:5432/}"; pg_dump "$U" -Fc -n public -n drizzle -n auth -f ~/Backups/pts-portal/prod-$(date +%Y%m%d-%H%M).dump) && ls -la ~/Backups/pts-portal/prod-*.dump
   ```
2. Run `scripts/rehearse-rollout.sh <dump>`. Expect:
   - 41/41 compare checks;
   - ALL CHECKS PASS;
   - no close drift;
   - 0 undo differences.
3. Check that nobody was stopped as a client earlier in the release month: after the migration, a stop dated this month counts as billed through the month (I8).
4. In Supabase › SQL editor, run `select has_table_privilege('postgres', 'auth.sessions', 'DELETE'), has_table_privilege('postgres', 'auth.refresh_tokens', 'DELETE');`. Expect both true. The S1 takeover needs them; if they're false, granting a sign-in to a reused email fails safely with an error.
5. Confirm `CRON_SECRET` is set in Vercel (new daily `/api/cron/apply-role-terms`).
