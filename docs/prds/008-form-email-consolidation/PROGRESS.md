# PRD 008 — Progress

Sections map to the `§` headings in [README.md](./README.md). Implementation order is top to
bottom; each block depends only on the ones above it.

## A. Schema (§4)

- [x] `delivery_requested_at`, `team_notified_at`, `confirmation_sent_at` added to `formSubmissions` in `packages/db/src/schema.ts`
- [x] Migration generated with `db:generate`, SQL reviewed (additive only), applied locally
- [x] `destroyFormSubmission` leaves the three stamps alone; record/twin types carry them <!-- no snake-case twin exists for submissions; FormSubmissionRecord spreads the row, so the columns flow through -->

## B. Source summary (§6)

- [x] `lib/form-submissions/attribution.ts` exports pure `describeAttribution` returning `{ channel, label }`
- [x] Paid / campaign / organic / referral / social / email / direct cases verified with a case table <!-- 14-case tsx script, all pass; neither repo has a test runner, so it is not checked in. Added a `campaign` channel for UTM-tagged traffic that is neither paid, email nor social, and own-domain referrers count as direct -->

## C. Templates, env, catalog (§5)

- [x] Shared block helpers in `packages/email` so text and HTML come from the same data
- [x] `contactNotificationEmail`, `contactConfirmationEmail`, `auditNotificationEmail`, `auditResultsEmail` exported from `@pts/email`
- [x] Team layout order: Open in portal → contact details → message/result → Where they came from → repeat-sender line → transcript (audit)
- [x] `RESEND_FORMS_FROM_EMAIL`, `FORMS_NOTIFY_EMAIL`, `RESEND_AUDIENCE_ID` in `env.server.ts`, `turbo.json`, `.env.example`
- [x] Four catalog entries with fake samples; "not shown here" footnote removed from `emails-browser.tsx`

## D. Delivery pipeline (§1, §2, §4)

- [x] Both payload schemas accept optional `deliver` (default false); portal sends only when true
- [x] Route order is verify → validate → upsert → send → respond; a send failure never fails the request
- [x] Response envelope `{ ok, data: { id, emails: { team, confirmation } } }`
- [x] Claim-then-send with release on failure; replayed payload cannot double-send
- [x] Sends require status `captured`, a `contact_email`, and a non-tombstoned row
- [x] Throttle `form-deliver:<email>` 3 / 15 min; over limit records the row without requesting delivery
- [x] Repeat-sender count + existing-lead link resolved for the team email
- [x] Audience add on consent, production only, best-effort, once per confirmation
- [x] `GET /api/cron/retry-submission-emails` sweep (5 min – 24 h window) + `vercel.json` schedule
- [x] `scripts/test-form-intake.ts` gains `--deliver`

## E. Submissions table + sheet (§7)

- [x] Columns: dot · Received · Form · Contact · Company · Outcome · Source · Actions (fixed layout, truncation)
- [x] Outcome cell: status badge + subject / phase / progress detail
- [x] Source cell: channel badge (label + color) + truncated label, full string in `title`
- [x] Received shows absolute timestamp in `title`, TZ-stable <!-- also moved the sheet's pre-existing ambient-TZ "Started" line onto formatCalendarDate so the sheet shows one clock -->
- [x] Anonymous rows muted; "With contact only" toggle (`contact=1`) implemented in `buildFilters` <!-- shipped as a FilterSelect with a second state, `contact=0` = anonymous only, matching the `?unacknowledged=` convention -->
- [x] Sheet: source summary under the contact header; Emails block from the §4 stamps

## F. Marketing site companion (§8, separate repo)

- [x] `send-contact.ts`: BotID → payload with `deliver: true` → await portal → success only on `ok`
- [x] `send-audit.ts` posts the `captured` payload behind BotID; `markCaptured` no longer pushes
- [x] Beacon route rejects `captured`, forces `lead: null`, never forwards `deliver`
- [x] Result-returning portal client with timeout; log-and-continue variant kept for beacons
- [x] D1 error copy; `AuditFailureReason` gains `portal_rejected` / `portal_unreachable`
- [x] Resend code, `audit-emails.ts`, `resend` dependency, and Resend env vars removed <!-- removed from code and .env.example; also dropped the now-dead `summarizeAnswers`. Deleting the vars in Vercel is a manual step, listed under G -->
- [x] Site PRD 005 contract notes updated

## G. Docs + rollout

- [x] `docs/integrations/marketing-form-submissions.md` documents `deliver`, the response envelope, and the beacon rule
- [x] `CLAUDE.md` email + env notes updated
- [ ] Migration applied in production via `db:migrate:prod` <!-- MANUAL STEP for the user: from the MAIN checkout (not a worktree — it reads apps/internal/.env.prod), run `npm run db:migrate:prod` in packages/db after the portal PR merges. Migration 0079 is additive. -->
- [ ] Three env vars set in Vercel (internal project) <!-- MANUAL STEP for the user: RESEND_FORMS_FROM_EMAIL=hello@send.placetostandagency.com, FORMS_NOTIFY_EMAIL=hello@placetostandagency.com, RESEND_AUDIENCE_ID=<copy from the marketing site's Vercel project>. All optional, but without the first one visitor mail comes from portal@. CRON_SECRET must already be set for the sweep to run. -->
- [ ] Verify the Vercel plan permits the `*/15` cron <!-- MANUAL STEP for the user: Hobby allows daily crons only and the deploy will fail on this schedule. If the team is on Hobby, change apps/internal/vercel.json to a daily schedule and widen MAX_AGE_HOURS in the route accordingly. -->
- [ ] Site Resend env vars removed from Vercel after a quiet week <!-- MANUAL STEP for the user: delete RESEND_API_KEY and RESEND_AUDIENCE_ID from the marketing site's Vercel project once the cutover has run clean for a week. -->
- [ ] Merge order respected <!-- MANUAL STEP for the user: portal PR first, then migrate + env vars + one `--deliver`-style check, THEN the marketing site PR (claude/portal-sends-form-email). Merging the site first means forms succeed but no email is sent, because the portal would ignore `deliver`. -->
