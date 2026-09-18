# PRD 008 — Form email consolidation + scannable submissions

**Status:** Implemented on `claude/email-sending-consolidation-aba781` (portal) and `claude/portal-sends-form-email` (marketing site) — not yet deployed; see Rollout
**Created:** 2026-09-17
**Branch:** `claude/email-sending-consolidation-aba781`
**Repos touched:** `place-to-stand-portal` (one PR, this PRD) and `place-to-stand` (marketing
site, one companion PR — it is a separate repository, so "one PR" means one per repo).

---

## Why this exists

The marketing site sends four emails itself (contact + audit, each with a team notification and
a visitor confirmation) from `app/actions/send-contact.ts` and `app/actions/send-audit.ts`, using
its own Resend key and, for the audit, its own private HTML shell. The portal already receives
both forms — `POST /api/integrations/contact-submissions` and `/audit-responses`, bearer-token
authenticated, storing the full attribution + PostHog + device envelope in `form_submissions` —
but sends nothing, and none of that tracking data reaches the inbox or the list view.

Three problems fall out of that split:

1. **Templates live in two repos.** The portal's templates panel carries a footnote admitting the
   marketing recaps are not shown (`settings/templates/_components/emails-browser.tsx:76-79`).
2. **The team email is not scannable and has no way back.** Contact is plain text with no portal
   link and no source; the tracking data we collect is only visible by opening the sheet.
3. **The submissions table is not scannable.** Contact rows render `—` in two of eight columns
   (Progress, Phase) and never show the subject, the single most useful field on the row.

## Decisions (Jason, 2026-09-17)

| # | Decision |
| --- | --- |
| D1 | **Portal unreachable → the visitor sees an error** pointing at `hello@placetostandagency.com`. No fallback send on the site; the site ends up with no email code and no Resend key. |
| D2 | **The marketing-consent audience add moves to the portal** (`RESEND_AUDIENCE_ID` is already in `apps/internal/.env.example`, unused). |
| D3 | **Visitor-facing emails take the portal shell** (dark masthead). The site's light wordmark/lime-rule audit shell is deleted. |
| D4 | **Everything ships together**: email move and table/sheet scannability in one portal PR. |

## Design

### §1 Record first, then send

The dependency inverts. Today email is the hard requirement and the portal write is best-effort;
after this PRD the portal write is the hard requirement and email is retried.

- Intake route order: verify token → validate → **upsert row** → attempt sends → respond.
- A Resend failure never fails the request. The row exists, flags unread, and the sweep (§4)
  retries. Today the same failure shows the visitor an error and records nothing.
- A portal failure (non-2xx, timeout, unreachable) is the only thing the visitor sees as an error
  (D1).

### §2 Opt-in delivery flag (rollout safety)

Both payload schemas gain an optional `deliver: boolean` (default `false`). The portal sends only
when `deliver === true`. Deploying the portal is therefore inert; the site deploy is the single
cutover moment, with no double-send and no gap. Rows that predate the cutover never have
`delivery_requested_at` set, so the sweep can never retro-email them.

Response bodies move to the standard envelope:
`{ ok: true, data: { id, emails: { team, confirmation } } }` where each is
`'sent' | 'queued' | 'skipped'`. The site only branches on `ok`.

### §3 The audit `captured` push moves behind BotID — **security-critical**

The site's `/api/audit-progress` beacon route deliberately skips BotID because, per its own
header comment, "no email is sent". The `captured` push (carrying name + email) currently goes
through that beacon (`src/hooks/use-audit.ts` `markCaptured`). If the portal mailed on `captured`
as-is, the beacon would become an open relay: anyone could POST a victim's address and have us
send branded mail to it.

Site changes:
- `sendAudit` (already BotID-gated) receives the full progress payload from the client, validates
  it with the schema extracted from the beacon route into a shared module, overwrites
  `client.userAgent` from the request header, sets `deliver: true`, and **awaits** the portal.
- The beacon route's schema drops `'captured'` from `status` and `trigger`, forces `lead: null`,
  and never forwards `deliver` (Zod strips it; add an explicit test so it stays stripped).
- `markCaptured` stops pushing; it only commits local state after the action succeeds.

Portal side, belt and braces: sends happen only when the stored row is `captured`, has a
`contact_email`, and the claim in §4 succeeds.

### §4 Exactly-once-ish sends

Migrations (additive) on `form_submissions`:

| Column | Meaning |
| --- | --- |
| `delivery_requested_at timestamptz` | Set (COALESCE, never cleared) when a payload arrives with `deliver: true`. |
| `team_email_claimed_at` / `confirmation_email_claimed_at timestamptz` | Expiring lease (10 min) taken before a send. *(Added after review — the stamp alone made a crash mid-send look sent.)* |
| `team_notified_at timestamptz` | Team notification accepted by Resend. |
| `confirmation_sent_at timestamptz` | Visitor confirmation accepted by Resend. |

None are PII; `destroyFormSubmission` leaves them alone. Add them to the snake-case twin types and
`FormSubmissionRecord`.

Each send takes its **lease** first (`… WHERE sent IS NULL AND (claimed IS NULL OR claimed <
now() - 10 min) …`), sends with a Resend idempotency key `form-submission:<id>:<kind>`, then writes
the **stamp**; a failure clears the lease. A retry of the same `submissionId`/`sessionId` cannot
double-send, a crash mid-send leaves an expiring lease rather than a false stamp, and a lost
provider response is deduplicated provider-side.

**Sweep:** `GET /api/cron/retry-submission-emails` (`verifyIntakeToken` with `CRON_SECRET`, same
as the existing crons) retries rows where `delivery_requested_at` is between 5 minutes and 72
hours old and an *applicable* stamp is NULL (an audit captured without a result has no
confirmation to send and is not re-selected). Past 72h the sheet says "Not sent — retry window
passed". Schedule `*/15 * * * *` — **audit to verify the Vercel plan
allows sub-daily crons**; if not, fall back to one inline retry inside the request plus an hourly
or daily sweep.

**Throttle:** before honouring `deliver`, `consumeRateLimit` on `form-deliver:<email>` (3 per 15
min, same helper as `lib/auth/throttle.ts`), charged **per submission**: a replay of a row that
already has `delivery_requested_at` reuses that decision and spends nothing. Over the limit, the
row is still recorded but `delivery_requested_at` is not set, so nothing sends and the sweep
ignores it. Emails report `'skipped'`.

### §5 Templates

Four renderers in `packages/email/src/templates/`, exported from `templates/index.ts`, built on
`renderRichEmail` plus a small shared block helper (`detailRows`, `sectionLabel`) so text and
HTML come from the same data. The package stays dependency-free: templates take plain strings,
never DB or Zod types.

| Template | To | Reply-To | Subject |
| --- | --- | --- | --- |
| `contactNotificationEmail` | team | visitor | `[Contact] Jane Doe · Acme — Website redesign` |
| `contactConfirmationEmail` | visitor | team | `Thanks for contacting Place To Stand` |
| `auditNotificationEmail` | team | visitor | `[Audit] Jane Doe · Acme — Scale phase` |
| `auditResultsEmail` | visitor | team | `Your Place To Stand Opportunity Audit` |

The audit templates render from the stored `result` and `responses` JSON, which are already
self-describing (prompt, labels, phase name, recommendations + reasons) — the portal needs none
of the site's scoring code.

**Team notification layout, top to bottom:**
1. **Open in portal** button → `/submissions?submission=<id>` (built via `lib/sheets/hrefs.ts`
   on `serverEnv.APP_BASE_URL`; this link survives archive/restore).
2. Name, email (mailto), company, website.
3. Message (contact) or phase + recommendations (audit).
4. **Where they came from** — the one-line source summary (§6), then landing path, device ·
   timezone, and the PostHog replay link.
5. Repeat-sender line when applicable: "3rd submission from this email", plus a link to the
   existing lead when `leads.contact_email` matches (`idx_leads_contact_email_unique`).
6. Audit only: the full answer transcript, last, under its own label.

**Sender:** new optional env vars with fallbacks, so today's visible sender is preserved —
`RESEND_FORMS_FROM_EMAIL` (prod: `hello@send.placetostandagency.com`; falls back to
`RESEND_FROM_EMAIL`) and `FORMS_NOTIFY_EMAIL` (falls back to `RESEND_REPLY_TO_EMAIL`).
`RESEND_AUDIENCE_ID` becomes a real optional var. All three go in `lib/env.server.ts`,
`turbo.json` → `passThroughEnv`, `.env.example`, and Vercel.

**Audience add (D2):** when the confirmation claim is won and `marketing_consent` is true, call
`resend.contacts.create` — production only, best-effort, "already exists" swallowed. Logic moves
verbatim from the site.

**Catalog:** four entries in `lib/email/catalog.ts` with obviously-fake samples (contact: one
variant; audit: one variant each), and the "not shown here" footnote in `emails-browser.tsx` is
deleted.

### §6 One source summary, used everywhere

`apps/internal/lib/form-submissions/attribution.ts` exports
`describeAttribution(row) → { channel: 'paid' | 'organic' | 'referral' | 'social' | 'email' | 'direct', label: string }`.

- `gclid` or `utm_medium` ∈ {cpc, ppc, paid…} → **paid**: `Google Ads · brand-search · "shopify agency"`
- other `utm_*` → channel from medium: `newsletter · sept-launch`
- referrer only → search-engine hosts → **organic** `Organic · google.com`; else **referral** `Referral · clutch.co`
- nothing → **direct**

Pure function, unit-tested with a table of cases. The email, the table column, and the sheet
header all call it, so the three can never disagree.

### §7 Submissions table + sheet

Columns become: `dot · Received · Form · Contact · Company · Outcome · Source · Actions`
(archive mode keeps `Archived`). `layout='fixed'` with explicit widths and `truncate` stays, per
the tables convention.

- **Outcome** replaces Status + Progress + Phase. Status badge, then one detail string:
  contact → subject; audit captured/completed → phase name; in-progress/abandoned →
  `40% · step 3 of 7`. No more dead `—` cells on contact rows.
- **Source** — channel badge (label + color, never color alone) and the truncated
  `describeAttribution` label; full string in `title`.
- **Received** — relative time stays; absolute timestamp in `title` via `formatCalendarDate`
  conventions (no ambient-TZ `format()`).
- **Anonymous rows** (no name, no email) render `text-muted-foreground`, and a
  "With contact only" toggle joins the existing filter row as a list param (`contact=1`, default
  off) implemented in `buildFilters`.
- **Sheet:** the source summary moves up under the contact header, and a small **Emails** block
  shows `Team notified …` / `Confirmation sent …` / `Not requested` from the §4 columns.

### §8 Marketing site companion PR

- `send-contact.ts`: BotID → build payload (`deliver: true`) → await portal → success only on
  `ok`. Missing `submissionContext` no longer skips the portal call; send an empty envelope.
- `send-audit.ts`: per §3.
- `postToPortal` gains a result-returning variant with a timeout; the log-and-continue variant
  stays for progress beacons.
- Error copy (D1): "We couldn't send your message. Please email hello@placetostandagency.com."
  `AuditFailureReason` gains `portal_rejected` / `portal_unreachable`, replacing the `email_*`
  reasons so PostHog keeps distinguishing causes.
- Delete `src/lib/emails/audit-emails.ts`, the inline text builders, the `resend` dependency (via
  `npm uninstall`), and `RESEND_API_KEY` / `RESEND_AUDIENCE_ID` from `.env.example` + Vercel.
- Update the site's `docs/prds/005-form-submissions/README.md` contract notes.

## Rollout

1. Portal PR merges → run migration via `db:migrate:prod` from the main checkout → set the three
   env vars in Vercel. Behaviour unchanged (no payload sets `deliver` yet).
2. Verify in prod with `apps/internal/scripts/test-form-intake.ts` extended with `--deliver`
   against a throwaway address: both emails land, stamps set, replay is a no-op.
3. Site PR merges → cutover. Submit one real contact + one real audit.
4. After a quiet week, remove the site's Resend env vars in Vercel.

Rollback is the site PR revert alone; the portal can stay deployed.

## Docs to update

`docs/integrations/marketing-form-submissions.md` (contract, `deliver`, response envelope, the
§3 beacon rule), `CLAUDE.md` (email section + new env vars), `packages/email` header comments.

## Deliberately cut (do not scope-creep back in)

| Cut | Note |
| --- | --- |
| Attribution columns on `leads` / carry-over on promote | Real gap (promotion discards UTMs) — separate PRD. |
| "Create lead" action in the submission sheet | Same PRD as above. |
| Removing the dead `leads-intake` route | Done separately (Sep 2026), not part of this PRD. |
| Unifying the two `sendEmail` helpers (`lib/email/send.ts` vs `packages/email` transport) | Flagged in the transport header already; not needed here — intake uses the internal helper. |
| More sortable columns | Only `received` stays sortable. |
| Google Chat notification on new submission | Not requested. |

## Verification

- Unit: `describeAttribution` case table; claim/release semantics; schema strips `deliver` on the
  beacon path.
- Local end-to-end through Mailpit: contact + audit with `deliver`, replayed payload (no second
  email), forced send failure (row recorded, stamp released, sweep delivers), throttle (4th in
  window records but does not send), tombstoned session (no send).
- Templates panel shows four new entries, HTML + plain text, footnote gone.
- Browser: table at 1280 and 1440 — uniform row heights with loaded avatars absent, columns do
  not jump on sort, anonymous rows muted, toggle filters and survives pagination.
- `npm run build`, `npm run lint`, `npm run type-check` from the repo root.
