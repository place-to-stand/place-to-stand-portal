# place-to-stand-portal

- Supabase storage expects a private `user-avatars` bucket. Create it once with authenticated access before enabling avatar uploads in the portal.

## Your business details

- After the first sign-in, an admin fills in **Settings → Business**: name, address, phone, inbox email, sending email, booking link, time zone and, if you use it, the partner profit share on the monthly close. A new install starts blank, and a banner asks for these until they are saved. Emails, invoices and the client portal read them from there.
- Replies to portal email go to the **inbox email**, or to the sending address when it is blank.

## Sending email (Resend)

The portal sends all mail through [Resend](https://resend.com), from a domain you own and have verified there. Resend refuses mail from any other domain.

1. Create a Resend account, and add a sending domain under **Domains**. A subdomain such as `send.example.com` keeps this mail apart from your everyday inbox.
2. Add the DNS records Resend shows (SPF, DKIM and the return-path MX) at your DNS host, and wait until Resend marks the domain **Verified**.
3. Create an API key with full access (a sending-only key can't list domains, so the Business page can only accept addresses on the domain in `RESEND_FROM_EMAIL`).
4. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (an address on the verified domain, such as `portal@send.example.com`) in both apps. The marketing form emails can use their own sender in `RESEND_FORMS_FROM_EMAIL`.
5. Optionally set **Sending email** on Settings → Business. The portal checks its domain is verified in Resend before saving it.

Outside production, mail goes to Mailpit and needs none of this.

## Marketing form intake

- The marketing site POSTs the contact form to `/api/integrations/contact-submissions` and Opportunity Audit progress to `/api/integrations/audit-responses`. Each needs a `Bearer` token matching `CONTACT_INTAKE_TOKEN` / `AUDIT_INTAKE_TOKEN`.
- Generate each token with `openssl rand -hex 32` and store it under the same name in this app and in the marketing site (which also needs `PORTAL_API_BASE_URL`).
- Submissions are stored in `form_submissions` and appear at `/submissions`; leads are promoted from there by hand. See `docs/integrations/marketing-form-submissions.md` for the payload contract.

## Database migrations

- The current schema lives in `packages/db/src/schema.ts`. Keep these definitions in sync with the database.
- Existing Supabase migrations are captured in the baseline migration `drizzle/migrations/0000_supabase_baseline.sql` and the journal at `drizzle/meta/_journal.json`. Apply the baseline once (`npm run db:migrate`) after configuring `DATABASE_URL`; it will only register the existing state.
- Commands:
  - `npm run db:pull` – introspect the database into the schema file (use sparingly, only when the DB is the source of truth).
  - `npm run db:generate -- --name <change>` – create a SQL migration from schema edits.
  - `npm run db:migrate` – apply migrations using the configured `DATABASE_URL`.
- Typical change flow:
  1. Update the schema file in code.
  2. Run `npm run db:generate -- --name descriptive_label`.
  3. Review the generated SQL under `drizzle/migrations/`.
  4. Run `npm run db:migrate` locally, then in staging/production via the same command once reviewed.
- Ensure `DATABASE_URL` is present in your shell (export it or prefix the command) before running any of the Drizzle scripts. Use the Docker Postgres connection string for local development.
