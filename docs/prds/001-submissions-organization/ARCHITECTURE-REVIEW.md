# PRD 001 — Architecture & Product Review

Audit performed against the PRD (all section files) and the referenced codebase surfaces (`apps/internal`, `packages/db`). Findings are coded **C#** (critical), **W#** (warning), **I#** (info) for the engineering pass and **P# / PW# / PI#** for the product pass. Resolutions were decided interactively with the owner; each resolved finding is incorporated inline in the section files.

## Engineering findings

### C1 — Activity API target-type whitelist blocks the Activity tab — RESOLVED (fix in 05)

`apps/internal/app/api/activity/route.ts:8-22` maintains a runtime `VALID_TARGET_TYPES` array; unlisted types are rejected with 400 "Unsupported activity target type" (lines 68-77). The generic `ActivityFeed` fetches through this route (`apps/internal/lib/activity/use-activity-feed.ts` → `/api/activity`). Without adding `'SUBMISSION'` to the array, `/submissions/activity` renders a permanent error. Section 05 originally framed this as "verify no whitelist exists" and pointed at the wrong file.

**Resolution:** Section 05 now mandates adding `'SUBMISSION'` to `VALID_TARGET_TYPES` and lists `route.ts` in its modified files.

### W1 — Submission PII exposure via the activity API — RESOLVED (admin gate in 05)

The route authenticates (`getCurrentUser`) but does not authorize by role, and `fetchActivityLogs` (`apps/internal/lib/activity/queries.ts`) applies no scoping. Whitelisting `SUBMISSION` would let CLIENT-role users read activity summaries containing prospect names/emails. Pre-existing parity: `LEAD`, `HOUR_BLOCK`, `INVOICE` summaries are already readable by any authenticated user the same way.

**Resolution (owner):** Gate `SUBMISSION` to admins inside the route; spec added to section 05. **Update:** the systemic follow-up task has since landed — the route now 403s non-admins for any type outside `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES` and `fetchActivityLogs(user, filters)` enforces the allowlist plus client-membership row scoping. Section 05 was revised: keeping `SUBMISSION` out of the client-visible list is the whole gate; no new code needed.

### W2 — PostHog wrapper reuse doesn't compile and misclassifies events — RESOLVED (ship without tracking)

`SettingsEntity` (`apps/internal/lib/posthog/settings-types.ts:6`) is a closed union without `'form_submission'`, so the optional `trackSettingsServerInteraction` reuse in 03/04 would be a type error; the wrapper also emits the `SETTINGS_SAVE` interaction event, which would misclassify inbox actions as settings saves.

**Resolution (owner):** Submissions actions ship with **no PostHog server tracking**. The wrapper hedge was removed from 03/04 and PROGRESS.md; purpose-built event naming (requires the naming conversation per project PostHog rules) moved to [07-future-scope.md](07-future-scope.md).

### W3 — `packages/db/src/relations.ts` untouched by the new FK — RESOLVED (fix in 01)

The project migration workflow updates `schema.ts` *and* `relations.ts`. `formSubmissions` has no relations entry, and section 01 added an `acknowledged_by → users.id` FK without declaring a relation.

**Resolution:** Section 01 now declares a `formSubmissionsRelations` entry (acknowledgedByUser one-way relation). Nothing queries it yet, but the convention keeps `db.query` traversal available and the checklist honest.

### I1 — No verb/icon map in the feed renderer — VERIFIED

`apps/internal/components/activity/activity-feed-item.tsx` renders summaries directly; there is no target-type or verb map to extend. Section 05's conditional wording replaced with a definitive statement.

### I2 — Verified-sound assumptions (no action)

- Sidebar item-level `roles` override exists with the Canvas item as precedent (`navigation-config.ts`)
- `logActivity` call shape matches `archive-hour-block.ts` usage
- `getFormSubmissionById` returns the raw Drizzle row (has `acknowledgedAt` post-01)
- Postgres compares enums by declaration order → the D8 `excluded.status > stored.status` guard is valid
- Hour-blocks actions cell uses labeled `Button`s (outline/secondary/destructive) — 03/04 styling matches
- No snake-case `Db*` twin exists for `form_submissions` in `apps/internal/lib/types.ts` — nothing to mirror

### I3 — Client-side target types are unvalidated — CONTEXT

`normalizeTargetTypes` in `use-activity-feed.ts` accepts arbitrary strings; the API route whitelist is the sole enforcement point. Relevant context for C1/W1; no change beyond them.

## Product findings

(Brand context: placetostandagency.com's primary funnel is the free audit — "2 minutes, no email required" — which is why anonymous submissions dominate and the `captured` transition is the highest-value signal. The submissions inbox is daily triage for the two admins; this PRD touches no client-facing surface.)

### PW1 — Badge count with no way to locate unread rows — RESOLVED (unread filter in 03)

List ordering (`last_activity_at DESC`) interleaves ad noise; an unread captured row can sit pages down while the badge says "2 unread."

**Resolution (owner):** Section 03 adds an **Unread** quick filter (URL param `unread=1`) alongside kind/status on the List tab, backed by a query predicate matching D1.

### PW2 — No path from submission to conversation — RESOLVED (mailto in 03)

The natural post-triage action is emailing the prospect ("we should probably email these people anyways" — transcript 00:46:13), but the sheet rendered `contactEmail` as plain text.

**Resolution (owner):** Section 03: `contactEmail` in the detail sheet renders as a `mailto:` link.

### PI1 — Badge invisible on mobile — NOTED

The sidebar is `hidden md:flex`; there is no mobile nav to badge. Pre-existing limitation, out of scope.

### PI2 — Deferred-item priority — CONFIRMED

The completed-submission email alert (future scope) is the likeliest next ask (the transcript opens with "I didn't get an email"), but the owner explicitly deferred it; the D8 re-flag partially compensates. Already documented in 07.

## Post-implementation review pass (2026-08-04, multi-reviewer on the full PR)

Second `/review-and-fix` run after the implementation + design revision landed. Seven unique findings (Claude ×1 below-bar, Codex standard ×2, Codex adversarial ×5, one overlap):

| Code | Finding | Resolution |
|------|---------|------------|
| F1 (Codex P1 + adversarial high) | "Delete forever" left prospect PII in prior activity summaries and embedded PII in the destruction event itself | **Fixed** — destroy transactionally purges the row's `SUBMISSION` activity logs and emits a PII-free event ("Permanently deleted an audit/contact submission") |
| F2 (Codex P2) | Row actions on the last row of page > 1 stranded the user on an empty out-of-range page | **Fixed** — `refreshAfterAction` steps pagination back when the acted row was the page's only row (row actions and sheet actions both route through it) |
| F3 (adversarial high) | Stale-view acknowledge race: a beacon advancing the row between render and click let an admin acknowledge data they never saw, defeating D8 | **Fixed** — acknowledge carries `expectedLastActivityAt` as a version token; the conditional UPDATE misses on mismatch and the action returns "changed since you viewed it" |
| F4 (adversarial medium) | Optimistic `ackOverride` never reconciled; sheet held stale row snapshots across refreshes | **Fixed** — table selection is by id and derived from fresh props; the override is dropped via render-time state adjustment when the sheet closes, the row changes, or the server confirms |
| F5 (adversarial high) | Hard delete freed the unique `session_key`, so a late intake beacon could resurrect a "deleted" submission | **Fixed** — destroy is now a PII-stripping tombstone (`destroyed_at`, migration `0055`): the row keeps its `session_key`, the intake `setWhere` rejects all beacons for tombstones, tombstones are excluded from every list/count and can never be restored |
| F6 (adversarial medium) | `logActivity` swallows failures app-wide — audit trail is best-effort, mutations succeed even when the event is lost | **Skipped** — pre-existing systemic pattern shared by every domain; a transactional-outbox redesign is out of scope for this PR. Candidate for a dedicated task. |
| F7 (Claude, below-bar) | Migration `0054` backfill skips already-archived rows; a pre-feature archived row restored later reappears unacknowledged | **Skipped** — arguably desirable (restore resurfaces for review); no archived submissions exist in production yet |

All fixes were verified live: tombstone destroy + failed beacon resurrection over real HTTP, stale-acknowledge conflict toast, page back-step, and the override-replay scenario.

## Summary

| Code | Severity | Status | Landed in |
|------|----------|--------|-----------|
| C1 | Critical | Fixed | 05 |
| W1 | Warning | Fixed (admin gate) | 05 |
| W2 | Warning | Fixed (no tracking) | 03, 04, PROGRESS |
| W3 | Warning | Fixed (relation) | 01 |
| I1–I3 | Info | Verified/context | — |
| PW1 | Product warning | Fixed (unread filter) | 03 |
| PW2 | Product warning | Fixed (mailto) | 03 |
| PI1–PI2 | Product info | Noted | — |
