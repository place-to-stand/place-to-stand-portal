# 03 — Updates Timeline UI

**PRD:** [005](README.md) · **Complexity:** High · **Schema:** Yes (column drops) · **App:** `apps/internal`
**Depends on:** [02-schema-lead-updates.md](02-schema-lead-updates.md) **and**
[06-lead-settings.md](06-lead-settings.md) *(D19's thresholds are configured there)*
· **Blocks:** Nothing
**Decisions:** [D3, D4, D5, D6, D19, D20, D21, D22, D23, D24](README.md#key-decisions)

---

## Problem

With `lead_updates` in place (§02), nothing yet writes to or reads from it. Kris's stated goal is
cadence visibility — *"we want to see how long it takes between touches"* — which needs three things
the lead sheet doesn't have:

1. A way to **log** an interaction with a type and a date.
2. A **timeline** that reads back scannably.
3. A **time-since-last-touch** readout.

There is also dead infrastructure to clear. `leads.last_contact_at` and `leads.awaiting_reply` are
read at four sites in `apps/internal/lib/data/leads/index.ts` (lines 71-72, 135-136, 186-187,
238-239) and typed at `apps/internal/lib/leads/types.ts:99-100`, but **grep the repository for a
writer and there is none**. They have never held a value. The read path made them look implemented.

## Fix

An Updates section in the lead sheet's right column, below Tasks (**D6**), with per-type color and
icon coding (**D5**), backed by a derived last-touch (**D4**).

---

## Last-touch derivation (D4)

Compute, don't store:

```sql
-- Illustrative only. Per C5, build the IN list from LEAD_TOUCH_TYPES via
-- inArray(leadUpdates.type, [...LEAD_TOUCH_TYPES]) — do NOT hardcode these
-- literals in the query, or the constant stops being the single source.
MAX(occurred_at) FILTER (WHERE type IN ('MEETING','PHONE_CALL','EMAIL') AND deleted_at IS NULL)
```

`NOTE` is excluded — an internal observation is not contact with the lead, and counting it would
show a lead as recently touched when nobody reached out. That's what `LEAD_TOUCH_TYPES` in
`apps/internal/lib/leads/updates.ts` is for.

**Why derived rather than a stamped column:** the project convention is that derived state (like
"overdue") is computed in queries rather than stored, because a stored copy goes stale the moment
the underlying row is edited or deleted. Here that's concrete — edit a logged call's date, or delete
a mis-logged email, and a stamped `last_contact_at` is silently wrong with no signal.

The composite index `idx_lead_updates_lead_occurred` from §02 serves this aggregate directly.

### Retiring the dead columns

Drop `leads.last_contact_at` and `leads.awaiting_reply`. **Both are covered by D4** — this was
settled at consistency-check, so there is no implementer judgment left here.

`awaiting_reply` goes for the same reason as `last_contact_at`: it is write-never, the same four read
sites are already being edited, and the feature that would give it a real basis (inbound/outbound
direction on updates) is deferred to [§07](07-future-scope.md) — which specifies re-deriving it from
the updates table rather than resurrecting the stored column.

**Verify the write-never claim against production before dropping (audit A1, W5):**

```sql
SELECT count(*) FILTER (WHERE last_contact_at IS NOT NULL) AS with_last_contact,
       count(*) FILTER (WHERE awaiting_reply IS TRUE)      AS with_awaiting
FROM leads;
```

Both should be `0` (`awaiting_reply` defaults to `false`, so a non-zero count means something does
write it and this section's premise is wrong — stop and re-investigate). Record the result in
[PROGRESS.md](PROGRESS.md).

The drop can ride along with §05's migration if that section lands first — it touches the same
table. Otherwise generate its own:

```bash
npm run db:generate -- --name drop_dead_lead_activity_columns
```

---

## Presentation tokens

Extend `apps/internal/lib/leads/updates.ts`. Follow the shape of `LEAD_STATUS_TOKENS` in
`apps/internal/lib/leads/constants.ts:19-33` — light and dark variants in one string.

```ts
import { CalendarDays, Mail, Phone, StickyNote, type LucideIcon } from 'lucide-react'

export const LEAD_UPDATE_TOKENS: Record<LeadUpdateTypeValue, string> = {
  MEETING:
    'border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  PHONE_CALL:
    'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  EMAIL:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  NOTE:
    'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
}

export const LEAD_UPDATE_ICONS: Record<LeadUpdateTypeValue, LucideIcon> = {
  MEETING: CalendarDays,
  PHONE_CALL: Phone,
  EMAIL: Mail,
  NOTE: StickyNote,
}
```

**Accessibility (WCAG 1.4.1):** color must never be the only signal. Every timeline entry renders
icon **and** text label **and** the color token together. Do not "simplify" to a bare colored dot.

---

## Staleness: the forward-looking half (D19)

Everything above measures cadence **backwards**. On its own that produces a number nobody acts on —
this agency runs without account managers, so the question that drives the day is *"who is overdue
for contact right now?"*, and until D19 no surface answered it.

### Thresholds — configured, not hardcoded (D22)

Staleness is stage-dependent: a brand-new opportunity going quiet for a week is a problem; an on-ice
lead doing the same is not.

**The thresholds live in `lead_stage_settings`, configured on the Settings tab — see
[§06](06-lead-settings.md).** The constant below stays in
`apps/internal/lib/leads/updates.ts` as the **fallback** when a status has no row, never as the
source of truth:

```ts
import type { LeadStatusValue } from './constants'

/**
 * FALLBACK ONLY. The live values come from lead_stage_settings (PRD 005 §06);
 * these apply when a status has no configured row. Deleting this would let a
 * missing row silently disable staleness — indistinguishable from a quiet board.
 */
export const LEAD_STALE_AFTER_DAYS: Record<LeadStatusValue, number | null> = {
  NEW_OPPORTUNITIES: 3,
  ACTIVE_OPPORTUNITIES: 7,
  PROPOSAL_SENT: 7,
  ON_ICE: 30,
  CLOSED_WON: null,
  CLOSED_LOST: null,
  UNQUALIFIED: null,
}

/** Thresholds come from fetchLeadStaleThresholds() — see §06 (C14). */
export function isLeadStale(
  status: LeadStatusValue,
  lastTouchAt: string | null,
  createdAt: string,
  thresholds: Map<LeadStatusValue, number | null>
): boolean
```

**A lead with no updates at all is stale once it is older than its threshold**, measured from
`createdAt`. Otherwise every pre-existing lead reads as fresh forever and the feature does nothing on
day one — the exact failure mode that killed `last_contact_at`.

### Card indicator

A small dot on the lead card, **not** a badge — D17's badge slot stays with origination and card
density must not move (W11).

- Rendered only when `isLeadStale()` is true.
- **Not color alone** (WCAG 1.4.1): the dot carries an `aria-label` and a tooltip reading
  `No contact in 14 days` with the absolute last-touch date. A screen reader user must get the same
  signal a sighted user does.
- Terminal-status leads never render it.

### Board filter row (D23)

**The leads board has no toolbar today** — `leads-workspace.tsx` renders straight into `PageShell`
with no filter row at all. This section adds one.

Create `apps/internal/app/(dashboard)/leads/_components/leads-board-filters.tsx`, mirroring
[`leads-archive-section.tsx:83`](../../../apps/internal/app/(dashboard)/leads/_components/leads-archive-section.tsx)
— the archive tab already does exactly this shape:

```tsx
const { update, getParam, hasActiveFilters, reset } = useListParams({ /* … */ })

<FilterBar>
  {/* "Needs follow-up" toggle */}
  {/* Assignee FilterSelect — "All assignees" */}
  <ResetFiltersButton onReset={reset} disabled={!hasActiveFilters} />
</FilterBar>
```

Rendered as the first child inside `PageShell` in `leads-workspace.tsx`, above the board.

**Two filters, not one (D23).** The follow-up toggle alone would be a lone control in an otherwise
empty row, and the board is shared across the team — an assignee filter makes *"my overdue leads"*
answerable in one step, which is the actual daily question. Import `FilterBar`, `FilterSelect`, and
`ResetFiltersButton` from `@/components/table-toolbar/`; do not build new primitives.

**Deliberately excluded:** status filtering (the kanban columns *are* the statuses) and search (the
command palette already covers it).

**State lives in URL params via `useListParams`**, matching every other filtered list in the app —
it survives refresh and makes "here's what we're dropping" a shareable link. The **filtering itself
is client-side** over the already-loaded board: `fetchLeadsBoard` returns every active lead, so a
server round trip would buy nothing and would fight the DnD state. The param is where the toggle's
state lives, not a query input.

> `useListParams` coexists with `useSheetParamSelection('lead')` on this page — both write to the
> query string. Follow the sheet conventions: `{ scroll: false }`, unrelated params preserved.

> **Do not** let this become a stored `is_stale` column. It is a pure function of `status`,
> `lastTouchAt`, `createdAt`, and the configured threshold — the same reasoning as D4.

---

## Data layer

### Query — `apps/internal/lib/queries/lead-updates.ts` (new)

```ts
import 'server-only'

/** Timeline rows for one lead, newest first, with author identity joined. */
export async function listLeadUpdates(
  user: AppUser,
  leadId: string
): Promise<LeadUpdateRecord[]>

/**
 * Derived last-touch per lead. Excludes NOTE (see LEAD_TOUCH_TYPES).
 * Batched by lead id so the board can render N leads without N queries.
 *
 * Takes AppUser and asserts admin — this is lead data, and there is no RLS
 * backstop if a future caller invokes it from an unguarded path (W26).
 */
export async function fetchLastTouchByLead(
  user: AppUser,
  leadIds: string[]
): Promise<Map<string, string>>
```

**Both helpers call `assertAdmin(user)`**, matching `listTasksForLead`
(`apps/internal/lib/queries/tasks/basic.ts:69`). There is no RLS; scoping is the query's job, and a
shared helper that can't authorize is one refactor away from leaking. Today's callers are all
guarded — that is exactly why the omission would be invisible until it isn't.

`fetchLastTouchByLead` takes ids rather than a single lead specifically to avoid an N+1 on the leads
board. Call it once with every visible lead's id.

### Data layer — `apps/internal/lib/data/leads/index.ts`

Replace the four `lastContactAt` / `awaitingReply` mappings with a `lastTouchAt` sourced from
`fetchLastTouchByLead`. Keep the shape flat — `LeadRecord` already flattens joined fields.

---

## Server actions

New directory `apps/internal/app/(dashboard)/leads/_actions/updates/`, matching the existing
`_actions/` convention:

| File | Export | Notes |
| --- | --- | --- |
| `create-lead-update.ts` | `createLeadUpdate` | Zod: `leadId` uuid, `type` enum, `body` 1–5000 chars trimmed, `occurredAt` ISO string defaulting to now |
| `update-lead-update.ts` | `updateLeadUpdate` | Edit body / type / occurredAt |
| `delete-lead-update.ts` | `deleteLeadUpdate` | **Soft** delete — set `deletedAt`, never hard delete |

Every action:

- `const user = await requireUser()` then `assertAdmin(user)`.
- Verifies the lead exists and `deletedAt IS NULL` before writing.
- For edit/delete, verifies the update belongs to the lead in the argument — don't trust the id alone.
- Returns the existing `LeadActionResult` shape from `_actions/types.ts`.
- Calls `revalidateLeadsPath()` from `_actions/utils.ts`.

> **W13 — `revalidateLeadsPath()` is incomplete for this section.** It currently revalidates only
> `/leads` and `/leads/archive`. `createLeadUpdate` writes a `LEAD_UPDATE_LOGGED` activity event, but
> `/leads/activity` is never revalidated, so the activity tab shows stale data after logging.
> **Add `revalidatePath('/leads/activity')` to the helper** — it benefits every existing lead action
> too, all of which have the same gap.

**`occurredAt` must not be in the future.** Reject it in the Zod schema; a future touch breaks
cadence math and is always a typo.

### Activity logging

Add to `apps/internal/lib/activity/types.ts` `ActivityVerbs` (beside the other `LEAD_*` verbs at
lines 131-140):

```ts
LEAD_UPDATE_LOGGED: 'LEAD_UPDATE_LOGGED',
```

Add a `leadUpdateLoggedEvent` to `apps/internal/lib/activity/events/leads.ts` following
`leadCreatedEvent`'s shape, re-export from `apps/internal/lib/activity/events.ts`, and call it from
`createLeadUpdate` with `targetType: 'LEAD'` and `targetId: leadId`. `LEAD` already exists in
`ActivityTargetType` (`types.ts:36`) — no new target type needed.

Log creation only. Edits and soft-deletes of an update don't warrant feed entries.

---

## Components

New directory `apps/internal/app/(dashboard)/leads/_components/lead-sheet/updates/`:

| Component | Responsibility |
| --- | --- |
| `lead-updates-section.tsx` | Section shell: heading, last-touch summary, "Log update" trigger, list. Mirrors `LeadTasksSection`'s structure. |
| `lead-update-composer.tsx` | Type selector + body editor + date field. Submits the create action. |
| `lead-update-item.tsx` | One timeline row: icon + type badge + relative date + author + body. |

### Wiring

`apps/internal/app/(dashboard)/leads/_components/lead-sheet/lead-sheet-right-column.tsx` currently
renders only `LeadTasksSection` inside a `space-y-6 p-6` wrapper. Add the new section below it — the
panel already has `overflow-y-auto`, so no layout change is needed:

```tsx
<div className='space-y-6 p-6'>
  <LeadTasksSection lead={lead} canManage={canManage} onSuccess={onSuccess} />
  <LeadUpdatesSection lead={lead} canManage={canManage} onSuccess={onSuccess} />
</div>
```

### Data loading

`LeadTasksSection` fetches from `/api/leads/[leadId]/tasks` on mount with a promise-chained `fetch`
(`lead-tasks-section.tsx:39-56`). Mirror it exactly: add
`apps/internal/app/api/leads/[leadId]/updates/route.ts` (GET, `requireRole('ADMIN')`, delegating to
`listLeadUpdates`), modeled on the existing tasks route.

Consistency with the neighboring section matters more here than switching to a different fetching
strategy for one panel.

### Last-touch readout

At the top of the section:

- Updates exist → `Last touched 12 days ago` with the absolute date in a `title` attribute.
- None → `No touches logged`.

**Use `formatCalendarDate` from `@/lib/dates` for all absolute dates.** Ambient-timezone
`format()` has caused production React #418 hydration errors and off-by-one dates in this codebase.
Relative strings ("12 days ago") must be computed from the same TZ-stable helper, not from a raw
`new Date()` diff in a client component.

### Empty, loading, and error states

- **Loading:** `Skeleton` from `@pts/ui/skeleton`, as `LeadTasksSection` does.
- **Empty:** short prompt plus the log-update trigger — not a bare "No updates."
- **Error:** the fetch currently only `console.error`s in `LeadTasksSection`, leaving a permanent
  skeleton-free empty list on failure. **Do better here:** set an error flag and render a retry
  affordance. Do not copy that silent failure forward.

### Sheet conventions

The composer is inline within the sheet, not a nested sheet — no new sheet param, no
`lib/sheets/entities.ts` change. If it ever becomes a dialog, it must follow the project's sheet
rules: `useSheetParams`, open = `push` / close = `replace`, `{ scroll: false }`.

**Save = done = close.** A successful log collapses the composer and prepends the entry.
**Never gate the Save button on `isDirty`** — disable only while the save is in flight or a real
validation precondition fails.

### "Add follow-up task" (D21)

An optional checkbox in the composer, unchecked by default. When checked, a successful save also
opens task quick-capture prefilled with this lead — `openNew('task')` with the lead param already
set, the same path `LeadTasksSection` uses today
(`lead-tasks-section.tsx` → `useSheetParams().openNew`).

The natural motion is *log a call → create a follow-up*, and D11 removed the presets that would
otherwise scaffold it. This is a **workflow shortcut only**: no `lead_update_id` on `tasks`, no
schema link, no reporting relationship. If the update save fails, the task capture must not open.

**Prefill the due date from the stage threshold (D24).** The captured task defaults to
`today + <this lead's configured staleAfterDays>` — 3 days for a new opportunity, 7 for an active
one, resolved through the same `fetchLeadStaleThresholds()` map the dot uses (§06).

One number drives both the staleness dot and the follow-up cadence, so they cannot disagree: a task
scheduled for the day the lead would otherwise go stale. A dateless follow-up task surfaces nowhere
and reintroduces exactly the passivity D19 exists to fix. The date stays editable before saving, and
a stage with no threshold falls back to no default rather than an arbitrary one.

---

## Architecture notes

- **C4 — Batch last-touch, don't map it.** `fetchLastTouchByLead` takes an array because
  `lastTouchAt` lives on the shared `LeadRecord` type, which the board's query hydrates for every
  lead across seven columns. A per-lead call would be an N+1 on the highest-traffic page in the
  section. Note this holds **even though the card does not display last-touch** (D17, W11) — the
  cost is in hydrating the type, not in rendering it.
- **C5 — `NOTE` exclusion is load-bearing.** It appears in three places: `LEAD_TOUCH_TYPES`, the SQL
  `FILTER`, and the empty-state copy. Keep the constant as the single source and import it into the
  query rather than re-listing the values.
- **W4 — Don't reuse `TaskComments` components.** They're bound to `taskId` and to the comment API
  routes. Sharing the presentational row is fine if a clean prop boundary exists; sharing the
  data-fetching layer is not.
- **W5 — Verify before dropping.** The `awaiting_reply` drop rests on a claim about production data.
  Run the audit query. If it returns non-zero, this section's premise is wrong.

---

## Acceptance criteria

**Data**
- [ ] `apps/internal/lib/queries/lead-updates.ts` exports `listLeadUpdates` (admin-asserted) and
      `fetchLastTouchByLead` (batched by id array).
- [ ] Last-touch excludes `NOTE` and soft-deleted rows, sourced from `LEAD_TOUCH_TYPES`.
- [ ] `apps/internal/lib/data/leads/index.ts` no longer references `lastContactAt` or
      `awaitingReply` at any of its four former sites.
- [ ] Production audit query run and result (expected `0`, `0`) recorded in PROGRESS.md.
- [ ] `leads.last_contact_at` and `leads.awaiting_reply` dropped via a generated migration.
- [ ] `LeadRecord` in `apps/internal/lib/leads/types.ts` drops both fields and gains `lastTouchAt`.

**Actions**
- [ ] Three server actions exist under `_actions/updates/`, each calling `requireUser()` +
      `assertAdmin(user)` and verifying the lead exists and is not soft-deleted.
- [ ] Edit and delete verify the update belongs to the lead in the argument.
- [ ] Delete is a **soft** delete (`deletedAt` set); no row is ever removed.
- [ ] `occurredAt` in the future is rejected with a validation message.
- [ ] `body` is trimmed and capped at 5000 characters.
- [ ] `LEAD_UPDATE_LOGGED` added to `ActivityVerbs`; `leadUpdateLoggedEvent` added, re-exported, and
      called on create with `targetType: 'LEAD'`.

**UI**
- [ ] `LeadUpdatesSection` renders below `LeadTasksSection` in `lead-sheet-right-column.tsx`.
- [ ] Each entry shows icon **and** type label **and** color token — color is never the sole signal.
- [ ] Timeline is ordered newest-first by `occurredAt`.
- [ ] Last-touch summary reads "Last touched N days ago" with an absolute date on hover, or
      "No touches logged" when empty.
- [ ] All absolute dates use `formatCalendarDate` from `@/lib/dates`.
- [ ] Loading uses `Skeleton`; empty state includes the log trigger; **fetch failure renders a
      retry affordance rather than a silent empty list.**
- [ ] Composer closes on successful save and the new entry appears without a full page reload.
- [ ] Save is **not** disabled based on `isDirty` — only during an in-flight save or a real
      validation failure.
- [ ] Logging a `NOTE` does **not** change the last-touch readout.
- [ ] Composer has an unchecked-by-default "Add follow-up task" checkbox; checking it opens task
      quick-capture prefilled with the lead after a successful save, and **not** on a failed save
      (D21).
- [ ] No `lead_update_id` column added to `tasks` — D21 is a shortcut, not a schema link.

- [ ] Captured follow-up task's due date prefills to `today + staleAfterDays` for the lead's stage,
      resolved through §06's threshold map, and stays editable (D24).

**Staleness (D19, D22)**
- [ ] Thresholds are read from `lead_stage_settings` via §06's `fetchLeadStaleThresholds()`;
      `LEAD_STALE_AFTER_DAYS` is used **only** as a per-status fallback (C14).
- [ ] `isLeadStale()` takes the threshold map as an argument — it does not import the constant.
- [ ] Terminal statuses (`CLOSED_WON`, `CLOSED_LOST`, `UNQUALIFIED`) are **never** stale.
- [ ] A lead with **no updates at all** is stale once `createdAt` passes its threshold — otherwise
      the feature does nothing on day one.
- [ ] Staleness dot renders on the lead card only when stale, and does **not** displace or restyle
      D17's origination badge.
- [ ] Dot carries an `aria-label` and tooltip with day count and absolute date — **not color alone**
      (WCAG 1.4.1).
- [ ] New `leads-board-filters.tsx` renders a `FilterBar` above the board with a **"Needs
      follow-up" toggle and an assignee `FilterSelect`** (D23), plus `ResetFiltersButton`.
- [ ] Filter primitives are imported from `@/components/table-toolbar/` — **no new primitives built**.
- [ ] No status filter and no search box (the columns are the statuses; the palette covers search).
- [ ] Toggle state lives in a URL param via `useListParams`; filtering itself is client-side.
- [ ] Filter params coexist with `useSheetParamSelection('lead')` — `{ scroll: false }`, unrelated
      params preserved.
- [ ] Toggle is **off by default**.
- [ ] No `is_stale` column added anywhere — staleness is computed, never stored.

**Revalidation**
- [ ] `revalidateLeadsPath()` also revalidates `/leads/activity` (W13).
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root.

---

## Files

**Created**
- `apps/internal/app/(dashboard)/leads/_components/leads-board-filters.tsx` *(D23)*
- `apps/internal/lib/queries/lead-updates.ts`
- `apps/internal/app/api/leads/[leadId]/updates/route.ts`
- `apps/internal/app/(dashboard)/leads/_actions/updates/create-lead-update.ts`
- `apps/internal/app/(dashboard)/leads/_actions/updates/update-lead-update.ts`
- `apps/internal/app/(dashboard)/leads/_actions/updates/delete-lead-update.ts`
- `apps/internal/app/(dashboard)/leads/_components/lead-sheet/updates/lead-updates-section.tsx`
- `apps/internal/app/(dashboard)/leads/_components/lead-sheet/updates/lead-update-composer.tsx`
- `apps/internal/app/(dashboard)/leads/_components/lead-sheet/updates/lead-update-item.tsx`
- `packages/db/drizzle/migrations/00XX_drop_dead_lead_activity_columns.sql` *(generated; may merge into §05's)*

**Modified**
- `apps/internal/lib/leads/updates.ts` — tokens, icons, `LEAD_STALE_AFTER_DAYS`, `isLeadStale`
- `apps/internal/app/(dashboard)/leads/_components/lead-card.tsx` — staleness dot (D19; coordinate
  with §05's origination badge in the same file)
- `apps/internal/app/(dashboard)/leads/_components/leads-workspace.tsx` — render the filter row
- `apps/internal/app/(dashboard)/leads/_actions/utils.ts` — add `/leads/activity` revalidation (W13)
- `apps/internal/lib/leads/types.ts` — `LeadRecord` field swap
- `apps/internal/lib/data/leads/index.ts` — four mapping sites
- `apps/internal/app/(dashboard)/leads/_components/lead-sheet/lead-sheet-right-column.tsx`
- `apps/internal/app/(dashboard)/leads/_actions/index.ts` — re-export new actions
- `apps/internal/lib/activity/types.ts` — `LEAD_UPDATE_LOGGED`
- `apps/internal/lib/activity/events/leads.ts` + `events.ts`
- `packages/db/src/schema.ts` — drop two columns
