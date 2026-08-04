# PRD 001 — Implementation Progress

Update this file at the end of every coding session. Mark items only when verified (build/lint/type-check green + manual check where applicable).

## Pre-implementation checklist

- [x] `DATABASE_URL` set locally; `npm run db:migrate` runs clean against current baseline (through `0053_form_submissions.sql`)
- [x] ~~PostHog wrapper confirmation~~ Resolved by audit (W2): submissions actions ship with **no** PostHog server tracking; purpose-built events are future scope. Nothing to confirm pre-implementation.
- [x] Read [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md) — C1/W1 (activity route), W2 (no tracking), W3 (relations), PW1/PW2 (unread filter, mailto) are all incorporated inline in sections; implement from the sections, not from memory
- [x] Seed/verify local `form_submissions` rows covering: contact, audit in_progress, audit abandoned, audit completed, audit captured (needed for D1 testing)
- [x] Read the hour-blocks reference surfaces before starting 02/04: `page.tsx`, `_components/hour-blocks-tabs-nav.tsx`, `archive/page.tsx`, `activity/page.tsx`, `actions/archive-hour-block.ts`, `_components/hour-block-archive-dialog.tsx`

## 01 — Schema + acknowledgement ([spec](01-schema-acknowledgement.md))

- [x] `acknowledgedAt` / `acknowledgedBy` added to `formSubmissions` (FK → users, `ON DELETE SET NULL`)
- [x] `idx_form_submissions_unread` partial index added
- [x] W3: `formSubmissionsRelations` declared in `packages/db/src/relations.ts`
- [x] Migration generated (`--name form_submission_acknowledgement` → `0054`), reviewed, backfill hand-appended
- [x] Migration applied locally; existing rows backfilled acknowledged (table was empty locally; backfill statement verified in SQL)
- [x] Upsert clears ack on status advance (D8); stale beacons can't touch ack (setWhere gate runs first)
- [x] `upsertFormSubmission` doc comment updated
- [x] Build / lint / type-check green

## 02 — Page shell + tabs ([spec](02-page-shell-tabs.md))

- [x] `SubmissionsTabsNav` created (List / Archive / Activity, hour-blocks styling)
- [x] `SubmissionsFilters` extracted with `basePath` prop
- [x] `/submissions` restructured: tabs row (filters + count right), card shell
- [x] `submissions-table.tsx`: filters/count removed, `mode` prop added, per-mode empty states
- [x] `archive/page.tsx` stub created (activeTab + mode wired, empty list until 04)
- [x] `activity/page.tsx` stub created
- [x] All three routes admin-gated (`requireRole('ADMIN')`); sidebar active state via existing `matchHrefs` prefix matching
- [x] Build / lint / type-check green

## 03 — Acknowledge + unread ([spec](03-acknowledge-unread.md))

- [x] `isUnreadSubmission` + `ATTENTION_AUDIT_STATUSES` in constants (sync comment → SQL count)
- [x] `acknowledgeFormSubmission` query (idempotent conditional update)
- [x] `actions/` scaffolding (`types`, `schemas`, `helpers`, `index`) + `acknowledge-submission.ts`
- [x] Unread dot + medium font on qualifying active rows only; extra head/colSpan updated (9 columns)
- [x] Row Acknowledge button (unread rows only, `stopPropagation`, icon-button style matching hour-blocks)
- [x] Sheet: Unread badge, Acknowledge button, `Acknowledged {relative time}`, optimistic state + `router.refresh()` (D9 keep-open)
- [x] `revalidatePath('/', 'layout')` on success
- [x] PW1: Unread quick filter (`?unread=1`) — filters component, page param, `unreadOnly` in queries/data layer
- [x] PW2: `mailto:` link on `contactEmail` in the detail sheet
- [x] W2: no PostHog server tracking in the action
- [x] Build / lint / type-check green

## 04 — Archive / restore ([spec](04-archive-restore.md))

- [x] `buildFilters` archived mode; list/count/data layer accept `archived`
- [x] `setFormSubmissionArchived` (direction-guarded, idempotent); `getFormSubmissionById` `includeArchived` option
- [x] `archive-submission.ts` / `restore-submission.ts` actions (`revalidatePath('/', 'layout')`)
- [x] `submission-archive-dialog.tsx` confirm dialog (ConfirmDialog wrapper, hour-blocks pattern)
- [x] Table `mode='archive'`: Restore action, Archived column, no unread/acknowledge affordances
- [x] Detail sheet Archive/Restore per mode; sheet closes after either (D9)
- [x] `archive/page.tsx` completed (archived fetch, count label, filters basePath)
- [x] Build / lint / type-check green

## 05 — Activity events + tab ([spec](05-activity-events.md))

- [x] `SUBMISSION` target type + 3 verbs in `apps/internal/lib/activity/types.ts`
- [x] `events/submissions.ts` builders (+ `describeSubmission` anonymous handling); re-exported from `events.ts`
- [x] All three actions log on real state change only (no logs on idempotent no-ops — gated on the mutation's returned row)
- [x] `submissions-activity-section.tsx` + `activity/page.tsx` completed (`ActivityFeed targetType='SUBMISSION'`)
- [x] C1: `'SUBMISSION'` added to `VALID_TARGET_TYPES` in `apps/internal/app/api/activity/route.ts`
- [x] W1: verified — `SUBMISSION` is NOT in `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES`, so the existing role gate 403s non-admins; no new gate code written (code inspection; runtime check is in TEST-PLAN)
- [x] Build / lint / type-check green

## 06 — Nav unread badge ([spec](06-nav-unread-badge.md))

- [x] `countUnreadFormSubmissions` (D1 predicate, sync comment)
- [x] `fetchUnreadSubmissionCount` (admin → count, non-admin → 0, `cache()`)
- [x] `(dashboard)/layout.tsx` fetches count and passes to `AppShell`
- [x] `AppShell` → `Sidebar` `badges` map; pill renders (hidden at 0, `99+` cap, sr-only text, active-state variant)
- [x] D10: `roles: ['ADMIN']` on the Submissions nav item in `navigation-config.ts`
- [x] Badge responds to acknowledge/archive/restore without hard refresh (`revalidatePath('/', 'layout')` in all three actions + `router.refresh()`; UI confirmation in TEST-PLAN)
- [x] Build / lint / type-check green

## Post-implementation

- [ ] Full [TEST-PLAN.md](TEST-PLAN.md) pass recorded <!-- MANUAL STEP for the user: sections 01 + prerequisites verified programmatically (14 items); the remaining UI flows need a signed-in browser session as each role (seeded users: autotest@local.test ADMIN, client@test.local CLIENT) -->
- [x] PRD README status flipped to "Implemented"
- [ ] Consider `/db-review` (new columns/index) and `/accessibility-review` (badge, dialog, indicator) <!-- deferred: optional post-landing review commands, user-invoked -->

## Session log

| Date | Sections touched | Notes |
|------|------------------|-------|
| 2026-08-03 | Pre-impl, 01–06 (all) | Full PRD implemented in one session. Migration `0054` applied locally; D8 upsert semantics + badge predicate verified against live DB (SQL, rolled back). Type-check/lint/build green after every section. Manual UI pass remains (TEST-PLAN). |
