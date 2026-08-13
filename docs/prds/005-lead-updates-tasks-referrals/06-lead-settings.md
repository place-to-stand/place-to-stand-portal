# 06 — Lead Settings

**PRD:** [005](README.md) · **Complexity:** Medium · **Schema:** Yes · **App:** `packages/db` + `apps/internal`
**Depends on:** Nothing (schema is standalone) · **Blocks:** [03-updates-timeline-ui.md](03-updates-timeline-ui.md) — D19's staleness thresholds read from here
**Decisions:** [D19, D22](README.md#key-decisions)

---

## Problem

D19 introduces staleness — a lead reads as overdue once it has gone N days without a touch. The
thresholds were invented during PRD authoring (3 / 7 / 7 / 30 by stage) and hardcoded as a TypeScript
constant.

That's wrong for two reasons:

1. **Nobody has used the feature yet**, so the numbers are a guess. The signal-to-noise ratio of the
   entire staleness feature rides on them. Set them too tight and the board is a wall of dots people
   learn to ignore; too loose and it never fires.
2. **Tuning a guess should not require a deploy.** A hardcoded constant means every adjustment is a
   PR, a review, and a release — which in practice means it never gets adjusted, and the feature
   quietly stops matching how the team actually works.

Jason, consistency-check: *"go with 3 / 7 / 7 / 30 but can you add a settings toggle to the leads
view? use the invoices settings page as an example."*

## Fix

A **Settings tab on `/leads`**, modeled on `/invoices/settings`, holding per-stage staleness
thresholds. The 3/7/7/30 values become **seed defaults**, not hardcoded behavior (**D22**).

---

## Precedent — and one correction

`/invoices/settings` ([page.tsx](../../../apps/internal/app/(dashboard)/invoices/settings/page.tsx))
is the model: a `PageShell` with the section's tabs, `activeTab='settings'`, `requireRole('ADMIN')`,
parallel data fetches, and one card containing per-concern sections
(`ProductCatalogSection`, `TaxRatesSection`).

> **Correction to a stale note.** Prior PRD notes describe a "singleton settings table with a CHECK
> constraint locking the PK to a sentinel UUID (see `billing_settings`)". **No `billing_settings`
> table exists in this schema** — a repo-wide grep for `_settings` as a table name returns nothing.
> That pattern was designed in PRD 002 and never shipped. Do not go looking for it.
>
> The real precedent is [`tax_rates`](../../../packages/db/src/schema.ts): a small keyed config
> table with a `unique` on the key, timestamps, and no soft delete. That is what this section
> follows.

---

## Schema

A keyed row per lead status, not a wide singleton — it mirrors `tax_rates`, keeps the enum as the
key, and means adding a lead status later doesn't require an `ALTER TABLE`.

Add to `packages/db/src/schema.ts`, after `leadStageHistory`:

```ts
export const leadStageSettings = pgTable(
  'lead_stage_settings',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    /** One row per status. Terminal statuses simply have no row. */
    status: leadStatus().notNull().unique(),
    /**
     * Days without a touch (see LEAD_TOUCH_TYPES) before a lead in this stage
     * reads as overdue. NULL = never stale.
     */
    staleAfterDays: integer('stale_after_days'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  }
)
```

No index beyond the unique constraint — the table holds at most seven rows and is read whole.

No `deletedAt`: this is configuration, not an entity. Matches `tax_rates`. **This is a second
carve-out from the soft-delete convention** alongside `contact_leads` (W14) — noted in TEST-PLAN X11.

### Seeding

The migration seeds the D19 defaults so the feature works on first deploy with no manual setup:

```sql
INSERT INTO lead_stage_settings (status, stale_after_days) VALUES
  ('NEW_OPPORTUNITIES', 3),
  ('ACTIVE_OPPORTUNITIES', 7),
  ('PROPOSAL_SENT', 7),
  ('ON_ICE', 30)
ON CONFLICT (status) DO NOTHING;
```

Terminal statuses (`CLOSED_WON`, `CLOSED_LOST`, `UNQUALIFIED`) get **no row** — absence means never
stale, which is simpler than storing `NULL` for them and avoids an "is this unset or deliberately
never?" ambiguity.

`ON CONFLICT DO NOTHING` keeps the migration re-runnable and means a re-deploy never stomps values
the team has tuned.

> This is a hand-appended `INSERT` on a generated migration — the same sanctioned exception §05 uses
> for its backfill (W9). Drizzle cannot express seed data.

### Migration

```bash
npm run db:generate -- --name lead_stage_settings
```

Then hand-append the seed `INSERT`. Purely additive — no `DROP`.

---

## Resolution order

`LEAD_STALE_AFTER_DAYS` in `apps/internal/lib/leads/updates.ts` **stays**, but changes meaning: it is
now the **fallback** used when a status has no settings row, not the source of truth.

```
lead_stage_settings row  →  LEAD_STALE_AFTER_DAYS fallback  →  null (never stale)
```

Keeping the constant means a missing row, a failed fetch, or a fresh database can never make
staleness silently vanish — it degrades to the seeded defaults rather than to "nothing is ever
overdue," which would look identical to the feature working.

---

## Data layer

New file `apps/internal/lib/queries/lead-stage-settings.ts`:

```ts
import 'server-only'

/** All configured thresholds, keyed by status. At most 7 rows — read whole. */
export async function fetchLeadStaleThresholds(): Promise<
  Map<LeadStatusValue, number | null>
>
```

Wrap in React `cache()` so the board page, the lead sheet, and the settings page share one read per
request.

`isLeadStale()` (§03) gains the resolved threshold map as an argument rather than importing the
constant directly — otherwise it can't see the configured value:

```ts
export function isLeadStale(
  status: LeadStatusValue,
  lastTouchAt: string | null,
  createdAt: string,
  thresholds: Map<LeadStatusValue, number | null>
): boolean
```

---

## Server action

`apps/internal/app/(dashboard)/leads/settings/actions.ts`, mirroring
`invoices/settings/actions.ts`:

```ts
'use server'

export async function saveLeadStageSettings(
  input: { status: LeadStatusValue; staleAfterDays: number | null }[]
): Promise<LeadActionResult>
```

- `requireUser()` then `assertAdmin(user)`.
- Zod: `staleAfterDays` is a positive integer ≤ 365, or null. **Reject 0** — a zero-day threshold
  marks every lead stale the moment it's created, which is indistinguishable from a broken feature.
- UPSERT on the `status` unique constraint.
- `revalidatePath('/leads')` **and** `revalidatePath('/leads/settings')` — the board's dots change
  the instant a threshold does.

---

## UI

### Tab

Add to `apps/internal/app/(dashboard)/leads/_lib/tabs.ts`, positioned as in `INVOICES_TABS`
(Settings before Archive):

```ts
export const LEADS_TABS: TabsNavTab[] = [
  { label: 'Leads', value: 'board', href: '/leads' },
  { label: 'Settings', value: 'settings', href: '/leads/settings' },
  { label: 'Archive', value: 'archive', href: '/leads/archive' },
  { label: 'Activity', value: 'activity', href: '/leads/activity' },
]
```

### Page

`apps/internal/app/(dashboard)/leads/settings/page.tsx` — a near-copy of the invoices settings page:

```tsx
export default async function LeadSettingsPage() {
  await requireRole('ADMIN')
  const thresholds = await fetchLeadStaleThresholds()

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/leads'), { label: 'Settings' }]}
      tabs={LEADS_TABS}
      activeTab='settings'
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <FollowUpCadenceSection initialThresholds={thresholds} />
      </section>
    </PageShell>
  )
}
```

### Section component

`apps/internal/app/(dashboard)/leads/settings/_components/follow-up-cadence-section.tsx`

- One numeric input per non-terminal stage, labelled with the stage name and the
  `LEAD_STATUS_TOKENS` badge so it reads as the same thing the board shows.
- Helper copy stating plainly what the number does: *"Mark a lead as needing follow-up after this
  many days without a logged meeting, call, or email. Notes don't count."* That last sentence is the
  `NOTE` exclusion (C5) surfaced to the person configuring it — otherwise the behavior looks like a
  bug.
- Terminal stages are listed as read-only rows reading "Never" so the page explains the whole model
  rather than silently omitting three of the seven statuses.
- **Save is not gated on `isDirty`** — disable only during an in-flight save.
- Empty input = never stale for that stage; make that explicit in placeholder text, not implied.

---

## Architecture notes

- **C14 — The constant becomes a fallback, not dead code.** Deleting `LEAD_STALE_AFTER_DAYS` once
  the table exists would mean a missing row silently disables staleness, which looks exactly like
  the feature working correctly on a quiet board. Keep the layered resolution.
- **W16 — Do not build this as a singleton settings table.** No such pattern exists in this schema
  (the `billing_settings` reference in older notes is to something that was never shipped). A keyed
  row per status mirrors `tax_rates` and survives new lead statuses without a migration.
- **W17 — Threshold changes must revalidate the board.** A stale `/leads` cache after saving makes
  the setting look broken. Revalidate both paths in the action.

---

## Acceptance criteria

**Schema**
- [ ] `lead_stage_settings` table added with `status` unique, nullable `stale_after_days`, timestamps,
      and **no** `deletedAt`.
- [ ] Migration generated via `npm run db:generate -- --name lead_stage_settings`, with the seed
      `INSERT … ON CONFLICT DO NOTHING` hand-appended.
- [ ] Seeds exactly `NEW_OPPORTUNITIES` 3, `ACTIVE_OPPORTUNITIES` 7, `PROPOSAL_SENT` 7, `ON_ICE` 30.
- [ ] Terminal statuses get **no row**.
- [ ] Re-running the migration does not overwrite tuned values.
- [ ] No RLS statements.

**Data**
- [ ] `fetchLeadStaleThresholds()` exists, is `cache()`-wrapped, and returns a status-keyed map.
- [ ] `isLeadStale()` takes the resolved threshold map — it does **not** import the constant directly.
- [ ] Resolution order is row → `LEAD_STALE_AFTER_DAYS` fallback → never stale (C14).

**Action**
- [ ] `saveLeadStageSettings` calls `requireUser()` + `assertAdmin(user)`.
- [ ] Zod rejects `0`, rejects negatives, rejects > 365; accepts null.
- [ ] UPSERTs on the `status` unique constraint.
- [ ] Revalidates **both** `/leads` and `/leads/settings` (W17).

**UI**
- [ ] `Settings` tab appears in `LEADS_TABS` between Leads and Archive, matching `INVOICES_TABS`
      ordering.
- [ ] `/leads/settings` renders under `PageShell` with `activeTab='settings'` and `requireRole('ADMIN')`.
- [ ] One input per non-terminal stage; terminal stages shown read-only as "Never".
- [ ] Helper copy states that notes don't count toward follow-up (C5).
- [ ] Save is **not** gated on `isDirty`.
- [ ] Saving a new threshold changes the board's dots without a manual refresh.
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root.

---

## Files

**Created**
- `apps/internal/app/(dashboard)/leads/settings/page.tsx`
- `apps/internal/app/(dashboard)/leads/settings/actions.ts`
- `apps/internal/app/(dashboard)/leads/settings/_components/follow-up-cadence-section.tsx`
- `apps/internal/lib/queries/lead-stage-settings.ts`
- `packages/db/drizzle/migrations/00XX_lead_stage_settings.sql` *(generated + hand-appended seed)*

**Modified**
- `packages/db/src/schema.ts` — `leadStageSettings` table
- `packages/db/src/relations.ts` — none needed (no FKs); confirm and move on
- `apps/internal/app/(dashboard)/leads/_lib/tabs.ts` — Settings tab
- `apps/internal/lib/leads/updates.ts` — `LEAD_STALE_AFTER_DAYS` becomes a documented fallback;
  `isLeadStale()` signature gains the threshold map
