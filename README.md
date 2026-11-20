# place-to-stand-portal

The portal an agency runs on: companies and people, leads, projects and task boards, time logs, prepaid hour blocks, invoices with Stripe payment, and a monthly close that works out payroll and commission. A second app, the client portal, lets clients see their projects and link GitHub.

![Home](docs/screenshots/home.png)

|                                            |                                                      |
| ------------------------------------------ | ---------------------------------------------------- |
| ![Task board](docs/screenshots/board.png)  | ![Leads](docs/screenshots/leads.png)                 |
| ![Invoices](docs/screenshots/invoices.png) | ![Monthly close](docs/screenshots/monthly-close.png) |

![Company sheet](docs/screenshots/company.png)

_Screenshots use made-up data._

## What's in the repo

- `apps/internal` – the internal portal (Next.js, port 3000).
- `apps/client` – the client portal (Next.js, port 3001).
- `packages/db` – the database schema and migrations, shared by both apps.
- `supabase/` – the local Supabase config.

## Run it on your machine

You need Node 26 (see `.nvmrc`), Docker, and the [Supabase CLI](https://supabase.com/docs/guides/local-development).

1. `npm install`
2. `npx supabase start` starts Postgres, Auth, Storage and Mailpit in Docker. It prints the API URL, anon key and service role key.
3. Copy `apps/internal/.env.example` to `apps/internal/.env.local`, and `apps/client/.env.example` to `apps/client/.env.local`. Fill in the Supabase keys from step 2, and the other required values in the tables below.
4. Apply the migrations: `cd packages/db && npm run db:migrate`.
5. Create the first admin (see [The first admin](#the-first-admin)).
6. `npm run dev` starts both apps. Sign in at http://localhost:3000.

Local mail lands in Mailpit (the URL `supabase start` prints), so you don't need a Resend account to work locally. The internal portal checks its required variables at start, so give the services you don't use locally a placeholder: any text for `RESEND_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `AI_GATEWAY_API_KEY`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and a real `openssl rand -base64 32` value for `OAUTH_TOKEN_ENCRYPTION_KEY`.

## Set it up in production

### 1. Supabase

1. Create a Supabase project. Note the project URL, anon key and service role key (Project Settings → API), and the pooled connection string (Connect → Transaction pooler) for `DATABASE_URL`.
2. Under Authentication → URL Configuration, set **Site URL** to the internal portal's URL, and add these redirect URLs, with your own hosts:
   - `https://portal.example.com/auth/**`
   - `https://clients.example.com/auth/**`
   - `http://127.0.0.1:53682/callback`, `http://127.0.0.1:53683/callback` and `http://127.0.0.1:53684/callback` (only if you use the `pts` CLI)

   The `/auth/**` pattern matters: without it, invite and sign-in links that carry a query string fall back to the Site URL and fail.

3. Apply the migrations to the new database: `DATABASE_URL=<connection string> npm run db:migrate` from `packages/db`.

### 2. Vercel

Create two Vercel projects from this repo, one for each app:

| Project         | Root directory  | Domain (example)      |
| --------------- | --------------- | --------------------- |
| Internal portal | `apps/internal` | `portal.example.com`  |
| Client portal   | `apps/client`   | `clients.example.com` |

Add the environment variables below to each project. A merge to `main` deploys both apps to production. Vercel skips builds of `claude/*` branches (`apps/internal/vercel.json`).

The internal portal runs four cron jobs, set in `apps/internal/vercel.json`. Vercel runs them by itself once `CRON_SECRET` is set. One runs every 15 minutes, which needs a Vercel Pro plan; Hobby allows only daily crons.

### 3. Environment variables: internal portal

Required:

| Variable                                                          | What it is                                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                    | Postgres connection string (Supabase pooler)                                                                     |
| `NEXT_PUBLIC_SUPABASE_URL`                                        | Supabase project URL                                                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                   | Supabase anon key                                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`                                       | Supabase service role key                                                                                        |
| `CLIENT_PORTAL_URL`                                               | Full URL of the client portal; client sign-ins are sent there                                                    |
| `RESEND_API_KEY`                                                  | Resend API key (see [Sending email](#sending-email-resend))                                                      |
| `RESEND_FROM_EMAIL`                                               | Sender address on your verified Resend domain                                                                    |
| `NEXT_PUBLIC_POSTHOG_KEY`                                         | PostHog project key                                                                                              |
| `NEXT_PUBLIC_POSTHOG_HOST`                                        | PostHog host, such as `https://us.i.posthog.com`                                                                 |
| `AI_GATEWAY_API_KEY`                                              | Vercel AI Gateway key, for planning and the activity summary                                                     |
| `OAUTH_TOKEN_ENCRYPTION_KEY`                                      | 32 random bytes in base64 (`openssl rand -base64 32`); encrypts saved Google, GitHub, Vercel and Supabase tokens |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google OAuth client (see [Google](#google))                                                                      |

Optional:

| Variable                                                                           | What it turns on                                                                        |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `APP_BASE_URL`                                                                     | The portal's own URL, for links in email                                                |
| `CRON_SECRET`                                                                      | Lets Vercel call the cron jobs (`openssl rand -hex 32`)                                 |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Card and bank payment of invoices (see [Stripe](#stripe))                               |
| `MERCURY_API_TOKEN`                                                                | Read-only Mercury token; the monthly close reads the month-end balance for profit share |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`                  | Staff link their GitHub accounts                                                        |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`                                          | The internal portal reads repos through the GitHub App                                  |
| `CONTACT_INTAKE_TOKEN`, `AUDIT_INTAKE_TOKEN`                                       | Marketing site forms (see [Marketing form intake](#marketing-form-intake))              |
| `RESEND_FORMS_FROM_EMAIL`, `FORMS_NOTIFY_EMAIL`, `RESEND_AUDIENCE_ID`              | Sender, team inbox and mailing list for form email                                      |
| `GOOGLE_CHAT_SALES_WEBHOOK_URL`                                                    | Posts new leads and late form email to a Google Chat space                              |
| `ACTIVITY_LOG_RETENTION_DAYS`                                                      | Days of activity history to keep (default 730)                                          |

### 4. Environment variables: client portal

| Variable                                                                                                                   | Required | What it is                                                       |
| -------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `DATABASE_URL`                                                                                                             | Yes      | Same database as the internal portal                             |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`                                   | Yes      | Same Supabase project                                            |
| `INTERNAL_PORTAL_URL`                                                                                                      | Yes      | Full URL of the internal portal; invoice payment hands off to it |
| `APP_BASE_URL`                                                                                                             | No       | The client portal's own URL                                      |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                                                                                      | No       | Sign-in email in production                                      |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`                                                                      | No       | Same PostHog project as the internal portal                      |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` | No       | Clients install the GitHub App and link repos                    |

### 5. Services

#### Google

Create an OAuth client (Web application) in Google Cloud. Add `https://portal.example.com/api/auth/callback/google` as a redirect URI and use the same value for `GOOGLE_REDIRECT_URI`. Enable the Gmail API. Staff connect their Google account from the Account sheet; lead email then syncs from Gmail.

#### GitHub

- **OAuth app** (staff): create one under GitHub → Settings → Developer settings, with callback `https://portal.example.com/api/auth/callback/github`.
- **GitHub App** (clients): create one with callback `https://clients.example.com/api/github/callback` and webhook URL `https://clients.example.com/api/github/webhook`. Put its id, private key, webhook secret and client credentials in the client portal, and its id and private key in the internal portal.

#### Stripe

Add a webhook endpoint at `https://portal.example.com/api/integrations/stripe` that sends these events:

- `payment_intent.succeeded`
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Put its signing secret in `STRIPE_WEBHOOK_SECRET`.

### The first admin

No one can sign in until a sign-in exists, and the portal has no sign-up page. Create the first one by hand:

1. In Supabase, go to Authentication → Users → Add user, and create a user with an email and password (tick **Auto confirm**).
2. In the SQL editor, run this, with your own email, name and agency name:

```sql
with auth_user as (
  select id, email from auth.users where email = 'you@example.com'
), staff as (
  insert into companies (name, slug, is_staff)
  values ('Your Agency', 'your-agency', true)
  returning id
), admin as (
  insert into users (id, email, role, onboarding_completed_at)
  select id, email, 'ADMIN', now() from auth_user
  returning id, email
), role_term as (
  insert into user_role_terms (user_id, role, effective_from)
  select id, 'ADMIN', date_trunc('month', now())::date from admin
), person as (
  insert into contacts (name, email, user_id)
  select 'Your Name', email, id from admin
  returning id
)
insert into memberships (contact_id, company_id)
select person.id, staff.id from person, staff;
```

3. Sign in. Add everyone else from the portal: open a person, switch on **Can sign in** and pick a role.

## Your business details

- After the first sign-in, an admin fills in **Settings → Business**: name, address, phone, inbox email, sending email, booking link and time zone. If you use the partner profit share on the monthly close, set it on **Settings → Billing**, beside the invoice products and tax rates. A new install starts blank, and a banner asks for these until they are saved. Emails, invoices and the client portal read them from there.
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

- The marketing site POSTs the contact form to `/api/integrations/contact-submissions`, mailing-list signups to `/api/integrations/subscribe-submissions` and Opportunity Audit progress to `/api/integrations/audit-responses`. Each needs a `Bearer` token: `CONTACT_INTAKE_TOKEN` for the first two, `AUDIT_INTAKE_TOKEN` for the audit.
- Generate each token with `openssl rand -hex 32` and store it under the same name in this app and in the marketing site (which also needs `PORTAL_API_BASE_URL`).
- Submissions are stored in `form_submissions` and appear at `/submissions`; leads are promoted from there by hand. See `docs/integrations/marketing-form-submissions.md` for the payload contract.

## Database migrations

The schema lives in `packages/db/src/schema.ts`, and the SQL migrations in `packages/db/drizzle/migrations/`. Run these from `packages/db`, with `DATABASE_URL` set (locally, `postgresql://postgres:postgres@127.0.0.1:54322/postgres`):

- `npm run db:generate -- --name <change>` writes a SQL migration from your schema edits. Read the SQL before you apply it.
- `npm run db:migrate` applies any migrations the database doesn't have yet.

**Migrate production before you merge.** A merge to `main` deploys both apps at once, so new code must never reach production before its migration. Run `npm run db:migrate:prod` from `packages/db` (it reads `apps/internal/.env.prod`), check it exits 0, then merge. Write migrations so the code already in production keeps working: add first, remove in a later release.

## License

MIT. See [LICENSE](LICENSE).
