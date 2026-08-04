# PRD 001 — Implementation Progress

Update this file at the end of every coding session. Mark items only when verified (build/lint/type-check green + manual check where applicable).

## Pre-implementation checklist

- [ ] `DATABASE_URL` set locally; `npm run db:migrate` runs clean against current baseline (through `0053_form_submissions.sql`)
- [ ] ~~PostHog wrapper confirmation~~ Resolved by audit (W2): submissions actions ship with **no** PostHog server tracking; purpose-built events are future scope. Nothing to confirm pre-implementation.
- [ ] Read [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md) — C1/W1 (activity route), W2 (no tracking), W3 (relations), PW1/PW2 (unread filter, mailto) are all incorporated inline in sections; implement from the sections, not from memory
- [ ] Seed/verify local `form_submissions` rows covering: contact, audit in_progress, audit abandoned, audit completed, audit captured (needed for D1 testing)
- [ ] Read the hour-blocks reference surfaces before starting 02/04: `page.tsx`, `_components/hour-blocks-tabs-nav.tsx`, `archive/page.tsx`, `activity/page.tsx`, `actions/archive-hour-block.ts`, `_components/hour-block-archive-dialog.tsx`

## 01 — Schema + acknowledgement ([spec](01-schema-acknowledgement.md))

- [ ] `acknowledgedAt` / `acknowledgedBy` added to `formSubmissions` (FK → users, `ON DELETE SET NULL`)
- [ ] `idx_form_submissions_unread` partial index added
- [ ] W3: `formSubmissionsRelations` declared in `packages/db/src/relations.ts`
- [ ] Migration generated (`--name form_submission_acknowledgement`), reviewed, backfill hand-appended
- [ ] Migration applied locally; existing rows backfilled acknowledged
- [ ] Upsert clears ack on status advance (D8); stale beacons can't touch ack
- [ ] `upsertFormSubmission` doc comment updated
- [ ] Build / lint / type-check green

## 02 — Page shell + tabs ([spec](02-page-shell-tabs.md))

- [ ] `SubmissionsTabsNav` created (List / Archive / Activity, hour-blocks styling)
- [ ] `SubmissionsFilters` extracted with `basePath` prop
- [ ] `/submissions` restructured: tabs row (filters + count right), card shell
- [ ] `submissions-table.tsx`: filters/count removed, `mode` prop added, per-mode empty states
- [ ] `archive/page.tsx` stub created (activeTab + mode wired)
- [ ] `activity/page.tsx` stub created
- [ ] All three routes admin-gated; sidebar active state correct on all three
- [ ] Build / lint / type-check green

## 03 — Acknowledge + unread ([spec](03-acknowledge-unread.md))

- [ ] `isUnreadSubmission` + `ATTENTION_AUDIT_STATUSES` in constants (sync comment → SQL count)
- [ ] `acknowledgeFormSubmission` query (idempotent conditional update)
- [ ] `actions/` scaffolding (`types`, `schemas`, `helpers`, `index`) + `acknowledge-submission.ts`
- [ ] Unread dot + medium font on qualifying active rows only; extra head/colSpan updated
- [ ] Row Acknowledge button (unread rows only, `stopPropagation`)
- [ ] Sheet: Unread badge, Acknowledge button, `Acknowledged {relative time}`, optimistic state + `router.refresh()`
- [ ] `revalidatePath('/', 'layout')` on success
- [ ] PW1: Unread quick filter (`?unread=1`) — filters component, page param, `unreadOnly` in queries/data layer
- [ ] PW2: `mailto:` link on `contactEmail` in the detail sheet
- [ ] W2: no PostHog server tracking in the action
- [ ] Build / lint / type-check green

## 04 — Archive / restore ([spec](04-archive-restore.md))

- [ ] `buildFilters` archived mode; list/count/data layer accept `archived`
- [ ] `setFormSubmissionArchived` (direction-guarded, idempotent); `getFormSubmissionById` `includeArchived` option
- [ ] `archive-submission.ts` / `restore-submission.ts` actions (`revalidatePath('/', 'layout')`)
- [ ] `submission-archive-dialog.tsx` confirm dialog
- [ ] Table `mode='archive'`: Restore action, Archived column, no unread/acknowledge affordances
- [ ] Detail sheet Archive/Restore per mode; sheet closes after either (D9)
- [ ] `archive/page.tsx` completed (archived fetch, count label, filters basePath)
- [ ] Build / lint / type-check green

## 05 — Activity events + tab ([spec](05-activity-events.md))

- [ ] `SUBMISSION` target type + 3 verbs in `apps/internal/lib/activity/types.ts`
- [ ] `events/submissions.ts` builders (+ `describeSubmission` anonymous handling); re-exported from `events.ts`
- [ ] All three actions log on real state change only (no logs on idempotent no-ops)
- [ ] `submissions-activity-section.tsx` + `activity/page.tsx` completed (`ActivityFeed targetType='SUBMISSION'`)
- [ ] C1: `'SUBMISSION'` added to `VALID_TARGET_TYPES` in `apps/internal/app/api/activity/route.ts`
- [ ] W1: verified that non-admin `targetType=SUBMISSION` requests get 403 (enforced by pre-existing role scoping — `SUBMISSION` kept out of `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES`; no new gate code)
- [ ] Build / lint / type-check green

## 06 — Nav unread badge ([spec](06-nav-unread-badge.md))

- [ ] `countUnreadFormSubmissions` (D1 predicate, sync comment)
- [ ] `fetchUnreadSubmissionCount` (admin → count, non-admin → 0, `cache()`)
- [ ] `(dashboard)/layout.tsx` fetches count and passes to `AppShell`
- [ ] `AppShell` → `Sidebar` `badges` map; pill renders (hidden at 0, `99+` cap, sr-only text, active-state variant)
- [ ] D10: `roles: ['ADMIN']` on the Submissions nav item in `navigation-config.ts`
- [ ] Badge responds to acknowledge/archive/restore without hard refresh
- [ ] Build / lint / type-check green

## Post-implementation

- [ ] Full [TEST-PLAN.md](TEST-PLAN.md) pass recorded
- [ ] PRD README status flipped to "Implemented"
- [ ] Consider `/db-review` (new columns/index) and `/accessibility-review` (badge, dialog, indicator)

## Session log

| Date | Sections touched | Notes |
|------|------------------|-------|
| — | — | — |
