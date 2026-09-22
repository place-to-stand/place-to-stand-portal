# PRD 008 — Architecture & product review

**Reviewed:** 2026-09-18, against the implemented code on `claude/email-sending-consolidation-aba781`
(portal, PR #234) and `claude/portal-sends-form-email` (marketing site), after the multi-reviewer
pass of the same day. This review audited the code, not just the PRD text.

## Principal Engineer

Verified clean, no finding:

- **Schema** — `delivery_requested_at`, `team_email_claimed_at`, `team_notified_at`,
  `confirmation_email_claimed_at`, `confirmation_sent_at` exist in `packages/db/src/schema.ts`;
  migrations 0079/0080 are additive and applied locally. No relation changes are needed. There is
  no snake-case twin type for submissions; `FormSubmissionRecord` spreads the row.
- **Queries / data split** — new SQL lives in `apps/internal/lib/queries/form-submission-delivery.ts`;
  orchestration in `apps/internal/lib/form-submissions/delivery/`; the list/sheet still read through
  `apps/internal/lib/data/form-submissions/` with `assertAdmin`.
- **Soft deletes** — every new query filters `destroyed_at`; list queries keep the `deleted_at`
  semantics of the tab they serve; the repeat-sender count intentionally includes archived rows.
- **Access control** — application layer only: both intake routes and the new cron go through
  `verifyIntakeToken`; the dashboard pages keep `requireRole('ADMIN')`; no RLS anywhere.
- **Routing** — `/api/cron/retry-submission-emails` is covered by the `/api/cron/` allowlist in
  `apps/internal/proxy.ts` and scheduled in `apps/internal/vercel.json`.
- **Revalidation** — the intake routes deliberately do not `revalidatePath` (documented on the
  route); `/submissions` renders dynamically.
- **Env** — the three optional vars are in `env.server.ts`, `turbo.json` `passThroughEnv`, and
  `.env.example`.

| Code | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| W1 | Warning | Team subject lines were built from raw visitor strings (`contact.name`, `company`, `subject`, `phaseName`); the intake schemas only trim ends, so an embedded CR/LF could reach the Subject header. | **Fixed.** `subjectSafe()` in `packages/email/src/templates/submission-shared.ts` collapses control characters and whitespace; used by `identityLine` and both team subjects. Verified with a CRLF/NUL case. |
| W2 | Warning | The site hook's `push` still accepted `status: 'captured'` at the type level, so a future edit could re-add a beacon capture (which the portal would reject, silently losing the lead). | **Fixed.** `push` args are `Exclude<AuditStatus, 'captured'>` / `Exclude<AuditTrigger, 'captured'>` in `place-to-stand/src/hooks/use-audit.ts`. |
| W3 | Warning | `formatEmailStamp` reads `Date.now()` during render in the submission sheet. | **Accepted, documented.** It cannot be a hook (the component returns early before it), the sheet is client-rendered so there is no hydration risk, the React Compiler memoises it, and the clock only changes the copy at the 72-hour boundary. |
| I1 | Info | `markSubmissionEmailSent` does not check lease ownership: if a lease expires mid-send (>10 min), two senders can both stamp. | Left. The Resend idempotency key prevents a duplicate email; only the stamp's attribution is imprecise. |
| I2 | Info | Two concurrent first-time requests for the same session can each spend a throttle token before either row exists. | Left. Costs at most one token in a 3-per-15-min budget. |
| I3 | Info | No index supports the sweep query. | Left. The table is hundreds of rows; revisit if it grows by orders of magnitude. |
| I4 | Info | Two migrations (0079, 0080) for one feature; neither applied in production. | Left, per Jason 2026-09-18: squashing means hand-editing the local journal and snapshot. |
| I5 | Info | `lib/form-submissions/delivery/render.ts` carries no `'server-only'` marker. | Left. It holds no secrets and is only imported by server modules. |

## Product Manager

Context: placetostandagency.com positions the agency as senior engineers building custom software
for mid-market businesses without in-house engineering, with the free Opportunity Audit as the
primary lead magnet ("tailored recommendations", "where to start first"). The two users of this PRD
are the agency admin triaging leads and the visitor receiving a confirmation; no client-portal
surface changes.

| Code | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PW1 | Warning | The visitor's audit results email got thinner than the site's old one: the stored result carried no phase tagline or per-service tagline, so recommendations were bare service names — at odds with the audit page's "tailored recommendations" promise. | **Fixed, per Jason: the site sends them.** `AuditResultPayload` gains `phaseTagline` and `recommendations[].tagline` (site); the portal schema accepts both as optional so older payloads still land; `AuditEmailResult` renders the phase tagline under the heading and each service tagline under its name, with the team-only "Signals" line moved to a quieter third line. Stored audits from before this field simply omit them. |
| PW2 | Warning | Most audit rows are anonymous and unfinished (30 of 32 locally), so the active list is still dominated by noise unless the admin picks "With contact only". | **Kept default off, per Jason.** Anonymous rows are muted, the filter is one click and persists in the URL, and the tab count stays honest. |
| PI1 | Info | No "resend" action on the sheet's Emails block. | Deliberately cut; the retry sweep covers failures and the row stays unread. |
| PI2 | Info | The confirmation promises a reply "within one business day" — same as the old site copy, but now portal-owned. | Noted; it is a commitment the team should keep or edit in `packages/email/src/templates/contact-confirmation.ts`. |
| PI3 | Info | Reply-To on team notifications is the visitor, so replying from the inbox answers them directly. | The biggest day-to-day win of the change; called out in the PR. |

## Files changed by this review

Portal: `packages/email/src/templates/{submission-shared,contact-notification,audit-notification,audit-shared}.ts`,
`packages/email/src/blocks.ts` (list `note` line), `apps/internal/lib/form-submissions/{audit-payload,types}.ts`,
`apps/internal/lib/form-submissions/delivery/render.ts`, `apps/internal/lib/email/catalog-forms.ts`,
`apps/internal/app/(dashboard)/submissions/_components/submission-detail-sheet.tsx`,
`apps/internal/scripts/test-form-intake.ts`, this file, `README.md`, `PROGRESS.md`.

Site: `src/lib/audit/progress-payload.ts`, `src/lib/audit/progress-schema.ts`, `src/hooks/use-audit.ts`.
