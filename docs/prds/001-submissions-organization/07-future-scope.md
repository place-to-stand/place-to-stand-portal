# 07 — Future Scope

Items discussed in the Aug 3, 2026 planning meeting (see [source/transcript.md](source/transcript.md)) that are **not** in this PRD, with context for why and when to revisit. Grep this file before drafting the next PRD — several of these are likely repeat asks.

## Portal — deferred features

### Email alert for completed submissions
Transcript 00:40:56, Kris: "we could maybe set an alert for completed or something." Tentative — no commitment. Would be a Resend send from the intake route (`apps/internal/app/api/integrations/audit-responses/route.ts`) when a row first reaches `completed`/`captured`. Revisit when: ad volume makes the badge insufficient, or a captured lead goes stale because nobody was in the portal. Note: the D8 status-advance re-flag gives partial coverage inside the portal already.

### Nav badge live updates (polling)
D6 chose server-fetch + revalidate; the count lags while a user idles on a page. Upgrade path: small admin-only API route + React Query `refetchInterval` (~60s) in the sidebar. Revisit when: the team notices stale counts in daily use.

### Show acknowledger identity in the detail sheet
03 displays `Acknowledged {relative time}` only; `acknowledged_by` is stored but not resolved to a user name (needs a join or a users lookup in the data layer). Revisit when: more than two admins triage submissions.

### ~~Role-scope the activity API for all sensitive target types~~ (W1 follow-up — DONE)
Landed as a separate fix after this PRD's audit: `fetchActivityLogs(user, filters)` now enforces a `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES` allowlist (`TASK`, `PROJECT`, `COMMENT`, `TIME_LOG`) plus client-membership row scoping for non-admins; the route 403s disallowed types; the dashboard recent-activity summary route is admin-only and its widget hidden for CLIENT users. Consequence for this PRD: keeping `SUBMISSION` out of the client-visible list is the entire W1 gate (see revised section 05).

### PostHog events for submissions actions (W2 follow-up)
Submissions actions ship with no server tracking — `trackSettingsServerInteraction` doesn't fit (`SettingsEntity` closed union, `SETTINGS_SAVE` semantics). If funnel-ops visibility is wanted, design purpose-built event/property names first (project rule: consult on naming before creating events).

### Pin unread rows to the top of the list
03 keeps `last_activity_at DESC` ordering. Revisit if the team asks for unread-first sorting.

### ~~Permanent destroy of archived submissions~~ (DONE — 2026-08-04 revision)
Originally deferred; implemented at the owner's request during post-implementation fine-tuning. `destroySubmission` (Archive tab only — the query layer refuses to destroy active rows) with a "Delete forever" confirm dialog, following the contacts archive pattern, logging `SUBMISSION_DESTROYED`.

### Promote submission → lead
Kris explicitly declined statuses/promotion for now: "I'm trying to keep as little manual work as possible" (00:50:00). The schema comment on `formSubmissions` anticipates manual promotion. If built later, wire `targetClientId`/lead linkage into the activity events from section 05.

### Documents / wiki section in the dashboard
00:35:58 — Jason: "we could just do it in the dashboard really just make like a documents section"; Kris leaned git-based ("it's a version control problem"); no decision. Both framed it as a *client product offering* as much as internal tooling. Needs its own PRD after a build/buy/git decision. Do not start from this PRD.

## Not portal work (tracked here so the next repeat-ask sweep finds them)

- **UTM attribution investigation** — Kris self-tasked (00:52:34). Marketing-site → PostHog → intake payload chain; the portal already stores `utm_*`/`gclid` faithfully (COALESCE rules in `upsertFormSubmission`). Portal work only if the fix requires intake contract changes.
- **PostHog error-tracking alerts** — Jason self-tasked (00:42:30). PostHog dashboard configuration, no repo changes.
- **Audit funnel changes** (free-form intent question, email-capture timing A/B test, cheap-model scoring) — marketing site repo (00:46:13–00:49:57).
- **"Powered by PTS" email attribution + free monitoring tier, 500-sends cap** — business-model brainstorm (00:53:28–00:59:27); would eventually touch client-app email templates, but no design exists.
- **Pricing model (setup fee + $300–400/mo platform fee), service tiers/component pricing** — business decision (00:22:38, 00:34:44); portal billing surfaces unaffected until a model is chosen.
- **Shopify per-store connector apps, partner referrals** — client project work (01:24:49–01:31:00), not this repo.
- **Canvas Playground ideas** (model selector, Figma-Weave-style nodes, post-to-chat generalization) — separate app; portal only links out via `CANVAS_PLAYGROUND_URL`.
- **Simplified Technical English skill; website copy line-by-line pass** — marketing site / tooling (01:09:41–01:16:26).
