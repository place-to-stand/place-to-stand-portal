# PRD 008 — Form email consolidation + scannable submissions

**Status:** Implemented and audited (see [ARCHITECTURE-REVIEW.md](./ARCHITECTURE-REVIEW.md)) — portal [PR #234](https://github.com/place-to-stand/place-to-stand-portal/pull/234) (`claude/email-sending-consolidation-aba781`) and marketing site branch `claude/portal-sends-form-email` (PR not yet opened). Reviewed 2026-09-18; not yet deployed — see Rollout.
**Created:** 2026-09-17
**Branch:** `claude/email-sending-consolidation-aba781`
**Repos touched:** `place-to-stand-portal` (one PR, this PRD) and `place-to-stand` (marketing
site, one companion PR — it is a separate repository, so "one PR" means one per repo).

---

## Why this exists

The marketing site sends four emails itself (contact + audit, each with a team notification and
a visitor confirmation) from `place-to-stand/app/actions/send-contact.ts` and `place-to-stand/app/actions/send-audit.ts`, using
its own Resend key and, for the audit, its own private HTML shell. The portal already receives
both forms — `POST /api/integrations/contact-submissions` and `/audit-responses`, bearer-token
authenticated, storing the full attribution + PostHog + device envelope in `form_submissions` —
but sends nothing, and none of that tracking data reaches the inbox or the list view.

Three problems fall out of that split:

1. **Templates live in two repos.** The portal's templates panel carries a footnote admitting the
   marketing recaps are not shown (`apps/internal/app/(dashboard)/settings/templates/_components/emails-browser.tsx`, since removed).
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

- Intake route order: verify token → validate → resolve the delivery request (§4 throttle) →
  **upsert row** → attempt sends → respond (`apps/internal/lib/form-submissions/delivery/intake.ts`).
- Nothing after the upsert can fail the request: a Resend failure, or even a failed read while
  preparing the send, leaves the row in place and flagged unread, reports `queued`, and the sweep
  (§4) retries. Today the same failure shows the visitor an error and records nothing.
- A portal failure (non-2xx, timeout, unreachable) is the only thing the visitor sees as an error
  (D1).

### §2 Opt-in delivery flag (rollout safety)

Both payload schemas gain an optional `deliver: boolean` (default `false`). The portal sends only
when `deliver === true`. Deploying the portal is therefore inert; the site deploy is the single
cutover moment, with no double-send and no gap. Rows that predate the cutover never have
`delivery_requested_at` set, so the sweep can never retro-email them.

Response bodies move to the standard envelope:
`{ ok: true, data: { id, emails: { team, confirmation } } }` where each is
`'sent' | 'queued' | 'skipped'`. `id` is `null` only when no row exists for the session. The site
branches on the HTTP status alone; the body is for logs.

### §3 The audit `captured` push moves behind BotID — **security-critical**

The site's `/api/audit-progress` beacon route deliberately skips BotID because, per its own
header comment, "no email is sent". The `captured` push (carrying name + email) currently goes
through that beacon (`place-to-stand/src/hooks/use-audit.ts` `markCaptured`). If the portal mailed on `captured`
as-is, the beacon would become an open relay: anyone could POST a victim's address and have us
send branded mail to it.

Site changes:
- `sendAudit` (already BotID-gated) receives the full progress payload from the client
  (`buildCapturedPayload` in `use-audit.ts`), validates it with `auditProgressSchema` from the
  shared module `place-to-stand/src/lib/audit/progress-schema.ts`, takes the lead from the
  validated form values (never from the payload), overwrites `client.userAgent` from the request
  header, sets `deliver: true`, and **awaits** the portal.
- The beacon route validates with `auditBeaconSchema` instead: `status` and `trigger` cannot be
  `'captured'`, `lead` is transformed to `null`, and `deliver` is stripped as an unknown key.
  Verified by a script (neither repo has a test runner); see Verification.
- `markCaptured` stops pushing; it only commits local state after the action succeeds.

Portal side, belt and braces: `deliver` is ignored unless `status` is `captured` and `lead` is
present, and a send happens only when the stored row is `captured`, has a `contact_email`, is not
tombstoned, and the lease in §4 is won.

### §4 Exactly-once-ish sends

Migrations (additive) on `form_submissions`:

| Column | Meaning |
| --- | --- |
| `delivery_requested_at timestamptz` | Set (COALESCE, never cleared) when a payload arrives with `deliver: true`. |
| `team_email_claimed_at` / `confirmation_email_claimed_at timestamptz` | Expiring lease (10 min) taken before a send. *(Added after review — the stamp alone made a crash mid-send look sent.)* |
| `team_notified_at timestamptz` | Team notification accepted by Resend. |
| `confirmation_sent_at timestamptz` | Visitor confirmation accepted by Resend. |

None are PII; `destroyFormSubmission` leaves them alone. There is no snake-case twin type for
submissions; `FormSubmissionRecord` spreads the row, so the columns flow through unchanged.

Each send takes its **lease** first (`… WHERE sent IS NULL AND (claimed IS NULL OR claimed <
now() - 10 min) …`), sends with a Resend idempotency key `form-submission:<id>:<kind>`, then writes
the **stamp**; a failure clears the lease. A retry of the same `submissionId`/`sessionId` cannot
double-send, a crash mid-send leaves an expiring lease rather than a false stamp, and a lost
provider response is deduplicated provider-side.

**Sweep:** `GET /api/cron/retry-submission-emails` (`verifyIntakeToken` with `CRON_SECRET`, same
as the existing crons) retries rows where `delivery_requested_at` is between 5 minutes and 72
hours old and an *applicable* stamp is NULL (an audit captured without a result has no
confirmation to send and is not re-selected). Past 72h the sheet says "Not sent — retry window
passed". Schedule `*/15 * * * *` (the team is on Vercel Pro, which allows sub-daily crons —
confirmed 2026-09-18). Constants live in `apps/internal/lib/form-submissions/delivery/constants.ts`,
shared with the sheet.

**Stuck-email alert (added 2026-09-21):** after retrying, the sweep looks for rows whose applicable
email is still unsent 60 minutes after it was requested and posts one Google Chat card to the Sales
space (`GOOGLE_CHAT_SALES_WEBHOOK_URL`, same helper as the invoice-paid notice) listing them with
portal links, plus a `console.error` for Vercel log alerts. Each row alerts once: the query selects
only the 15-minute window just past the threshold (`SWEEP_INTERVAL_MINUTES` must match
`vercel.json`). Without the webhook it is a no-op; the row still flags unread. Preview the card with
`npx tsx scripts/test-google-chat.ts --stuck`. **Ordering:** a status advance is never "stale" — the upsert gate is
`newer OR status advances` — so a `captured` push lands even if a progress beacon stamped later
arrived first, and a no-op replay of a captured row still flushes whatever it owes.

**Throttle:** before honouring `deliver`, `consumeRateLimit` on `form-deliver:<email>` (3 per 15
min, same helper as `apps/internal/lib/auth/throttle.ts`), charged **per submission**: a replay of a row that
already has `delivery_requested_at` reuses that decision and spends nothing. Over the limit, the
row is still recorded but `delivery_requested_at` is not set, so nothing sends and the sweep
ignores it. Emails report `'skipped'`.

### §5 Templates

Four renderers in `packages/email/src/templates/`, exported from `templates/index.ts`, built on
`renderRichEmail` plus a shared block renderer (`packages/email/src/blocks.ts`: heading, rows,
quote, list, pairs, button…) so text and HTML come from the same data. Shared pieces for the two
team notifications (contact rows, source block, repeat line) live in
`templates/submission-shared.ts`. The package stays dependency-free: templates take plain
strings, never DB or Zod types. The block renderer renders an href only for `http(s):` /
`mailto:` and the PostHog replay link only for `https://*.posthog.com` — both are visitor-supplied.

| Template | To | Reply-To | Subject |
| --- | --- | --- | --- |
| `contactNotificationEmail` | team | visitor | `[Contact] Jane Doe · Acme — Website redesign` (subject parts pass through `subjectSafe`, W1) |
| `contactConfirmationEmail` | visitor | team | `Thanks for contacting Place To Stand` |
| `auditNotificationEmail` | team | visitor | `[Audit] Jane Doe · Acme — Scale phase` |
| `auditResultsEmail` | visitor | team | `Your Place To Stand Opportunity Audit` |

The audit templates render from the stored `result` and `responses` JSON, which are already
self-describing (prompt, labels, phase name + tagline, recommendations with taglines + reasons)
— the portal needs none of the site's scoring code. The taglines were added after the audit
(PW1): the site sends `phaseTagline` and `recommendations[].tagline`, both optional portal-side so
older payloads still land, and audits stored before then simply render without them.

**Team notification layout, top to bottom:**
1. **Open in portal** button → `/submissions?submission=<id>` (`submissionHref` in
   `apps/internal/lib/sheets/hrefs.ts` on `serverEnv.APP_BASE_URL`, falling back to the
   `GOOGLE_REDIRECT_URI` origin; this link survives archive/restore).
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
`RESEND_AUDIENCE_ID` becomes a real optional var. All three go in `apps/internal/lib/env.server.ts`,
`turbo.json` → `passThroughEnv`, `apps/internal/.env.example`, and Vercel.

**Audience add (D2):** when *this request* sent the confirmation (not on a replay that lost the
lease) and `marketing_consent` is true, call `resend.contacts.create` — production only,
best-effort, "already exists" swallowed. Logic moves verbatim from the site
(`apps/internal/lib/form-submissions/delivery/audience.ts`).

**Catalog:** four entries in `apps/internal/lib/email/catalog-forms.ts` (split out of
`catalog.ts` for file size; `buildEmailTemplateCatalog` splices them in) with obviously-fake
samples, one variant each, and the "not shown here" footnote in `emails-browser.tsx` is deleted.

### §6 One source summary, used everywhere

`apps/internal/lib/form-submissions/attribution.ts` exports
`describeAttribution(row) → { channel, label, detail }` with
`channel: 'paid' | 'organic' | 'referral' | 'social' | 'email' | 'campaign' | 'direct'`, `label`
the full one-liner, and `detail` the label minus what a channel badge already says (null for
direct).

- `gclid` or `utm_medium` ∈ {cpc, ppc, paid…} → **paid**: `Google Ads · brand-search · "shopify agency"`
- other `utm_*` → **email** / **social** by medium, otherwise **campaign**: `newsletter · sept-launch`
- referrer only → search-engine hosts → **organic** `Organic · google.com`; social hosts →
  **social**; else **referral** `Referral · clutch.co`; a referrer on `placetostandagency.com`
  is internal navigation and counts as direct
- nothing → **direct**

Pure function, verified with a 14-case script (no test runner in the repo). The email, the table
column, and the sheet header all call it, so the three can never disagree.

### §7 Submissions table + sheet

Columns become: `dot · Received · Form · Contact · Company · Outcome · Source · Actions`
(archive mode keeps `Archived`). `layout='fixed'` with explicit widths and `truncate` stays, per
the tables convention.

- **Outcome** (`w-[21%]`) replaces Status + Progress + Phase. Status badge, then one detail
  string from `describeSubmissionOutcome` (`apps/internal/lib/form-submissions/outcome.ts`):
  contact → subject; audit with a phase → `Scale phase`; otherwise → `40% · step 3 of 7`. No
  more dead `—` cells on contact rows.
- **Source** — channel badge (label + color, never color alone) and the truncated
  `describeAttribution` label; full string in `title`.
- **Received** — relative time stays; absolute timestamp in `title` via `formatCalendarDate`
  conventions (no ambient-TZ `format()`).
- **Anonymous rows** (no name, no email) render `text-muted-foreground`, and a visitor filter
  joins the existing filter row as a `FilterSelect` on one list param, matching the
  `?unacknowledged=` convention: `contact=1` = with contact only, `contact=0` = anonymous only,
  default off; implemented in `buildFilters` as `hasContact`.
- **Sheet:** the source summary (channel badge + detail) sits in the header badge row, and an
  **Emails** block — rendered only when `delivery_requested_at` is set, so pre-cutover rows show
  nothing — reads `Sent <time>` / `Queued for retry` / `Not sent — retry window passed` (after
  72h) / `Not applicable` (audit confirmation with no stored result) per email. The sheet's
  pre-existing "Started" line also moved onto `formatCalendarDate` so it shows the same clock.

### §8 Marketing site companion PR

- `send-contact.ts`: BotID → build payload (`deliver: true`) → await portal → success only on a
  2xx. Missing `submissionContext` no longer skips the portal call; an empty envelope
  (`emptyContactSubmissionContext`) is sent instead.
- `send-audit.ts`: per §3.
- `submitToPortal` (result-returning, 15s timeout) joins `postToPortal` in
  `place-to-stand/src/lib/forms/portal.ts`; the log-and-continue `postToPortal` stays for
  progress beacons.
- Error copy (D1): "We couldn't send your message. Please email hello@placetostandagency.com."
  `AuditFailureReason` gains `portal_rejected` / `portal_unreachable`, replacing the `email_*`
  reasons so PostHog keeps distinguishing causes.
- Delete `place-to-stand/src/lib/emails/audit-emails.ts`, the inline text builders, the now-dead
  `summarizeAnswers` helper, the `resend` dependency (via `npm uninstall`), and
  `RESEND_API_KEY` / `RESEND_AUDIENCE_ID` from `.env.example` + Vercel.
- Update the site's `docs/prds/005-form-submissions/README.md` contract notes.

## Rollout

1. Portal PR #234 merges → run migrations `0079` + `0080` via `db:migrate:prod` from the main
   checkout → set the three env vars in Vercel (and confirm `CRON_SECRET` is set, or the sweep
   never runs) → delete `LEADS_INTAKE_TOKEN`. Behaviour unchanged (no payload sets `deliver` yet).
2. Verify in prod with `BASE_URL=https://<portal> CONTACT_INTAKE_TOKEN=… SMOKE_EMAIL=you+probe@…
   CRON_SECRET=… npx tsx scripts/test-form-intake.ts --smoke` from `apps/internal`: one real
   delivery to your alias, a replay that sends nothing, and a sweep call that returns
   `stillQueued: 0` (a 500 here means `CRON_SECRET` is unset on Vercel). Then check both inboxes
   — Reply-To on the team mail must be the alias — and "Delete forever" the probe row from the
   link the script prints. Optionally run the failure drill: point `RESEND_FORMS_FROM_EMAIL` at
   an unverified domain, submit, confirm `queued` + the unread row, restore the var, and watch the
   next sweep deliver.
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
| Unifying the two `sendEmail` helpers (`apps/internal/lib/email/send.ts` vs `packages/email` transport) | Flagged in the transport header already; not needed here — intake uses the internal helper, which gained an optional `idempotencyKey`. |
| Dead-letter state / operator retry for emails unsent after 72h | Reviewer suggestion; the sheet says "Not sent — retry window passed" and the row stays unread, which is the backstop. |
| More sortable columns | Only `received` stays sortable. |
| Google Chat notification on new submission | Not requested. |

## Verification

Neither repo has a test runner, so "unit" checks are throwaway `tsx` scripts, not checked in.

- Scripts: `describeAttribution` 14-case table; block renderer href guard + escaping; site
  `auditBeaconSchema` refuses `captured`, nulls a lead, strips `deliver` (6 cases).
- `apps/internal/scripts/test-form-intake.ts --deliver` against a local server + Mailpit: contact
  + audit with `deliver`, replayed payload (no second email, no quota spent), throttle (4th new
  submission records but does not send), `completed` + `deliver` ignored, an older `captured` push
  beating a newer beacon, unscored audit skipping its confirmation.
- Sweep, by hand with a local `CRON_SECRET`: a released/expired lease is re-sent, a live lease is
  left alone, a pre-cutover row and a tombstone are never selected, a request older than 72h is
  not selected, a second pass is a no-op, unauthenticated calls get 401.
- Templates panel shows four new entries, HTML + plain text, footnote gone; both team emails
  rendered from Mailpit.
- Browser at 1440 and 1280: uniform 41px rows, no horizontal scroll, every long cell truncates,
  anonymous rows muted, visitor filter narrows the list, sheet shows source + Emails block.
- `npm run build`, `npm run lint`, `npm run type-check` from the repo root, both repos.
