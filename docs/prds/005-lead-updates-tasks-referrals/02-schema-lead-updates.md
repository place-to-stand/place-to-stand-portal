# 02 — Schema: Lead Updates

**PRD:** [005](README.md) · **Complexity:** Medium · **Schema:** Yes · **App:** `packages/db` + `apps/internal`
**Depends on:** Nothing · **Blocks:** [03-updates-timeline-ui.md](03-updates-timeline-ui.md)
**Decisions:** [D1, D2, D3](README.md#key-decisions)

---

## Problem

Kris asked for *"an 'Updates' timeline which would allow us to log interactions that we have with the
client and notes about it — for example we want to see how long it takes between touches and we
should be able to log meeting, phone call, email, etc."*

Nothing in the schema can hold this today:

- **`task_comments` can't be reused.** `taskId` is `NOT NULL` with an `ON DELETE CASCADE` FK to
  `tasks` (`packages/db/src/schema.ts:628`). A lead update has no task. Kris's own suggestion —
  *"Could it just be comments labelled updates?"* — would require making that column nullable and
  adding a lead FK, so it isn't cheaper than a purpose-built table, and it would mix task discussion
  with relationship history in one table and one UI (**D2**).
- **`lead_stage_history` is the wrong grain.** It records pipeline stage transitions, not human
  contact.
- **`leads.notes`** is a single JSONB blob (`{ html }`) — one free-text field with no timestamps and
  no per-entry structure.
- **`leads.last_contact_at` exists but nothing writes it.** Read at four sites in
  `apps/internal/lib/data/leads/index.ts`; grep the repo for a writer and you find none. The metric
  Kris wants already has a column and has never had a value.

## Fix

A purpose-built `lead_updates` table, keyed to a lead, with a typed interaction kind and an
`occurred_at` distinct from `created_at`.

**Scope is leads only (D1).** Jason: *"these changes are consolidated to leads only, ignore
clients."* There is no polymorphic target and no client-side interaction log.

### Why `occurred_at` is separate from `created_at`

You log Monday's call on Wednesday. `created_at` is when the row was written; `occurred_at` is when
the interaction happened. Cadence math — the whole point of the feature — must use `occurred_at`, or
"days between touches" measures your data-entry habits instead of your client contact.

---

## Schema

Add to `packages/db/src/schema.ts`.

### Enum

Place beside the other lead enums (near `leadLossReason`, ~line 101):

```ts
/**
 * How a logged lead interaction happened.
 * Kept deliberately small at launch — see PRD 005 D3. Direction (inbound vs
 * outbound), SMS, and artifact-sent types are deferred to PRD 005 §07.
 */
export const leadUpdateType = pgEnum('lead_update_type', [
  'MEETING',
  'PHONE_CALL',
  'EMAIL',
  'NOTE',
])
```

`NOTE` is the catch-all for entries that aren't a touch — an internal observation, a piece of
context. Section 03 excludes `NOTE` from last-touch math for exactly this reason.

### Table

Place after `leadStageHistory` (~line 1023):

```ts
export const leadUpdates = pgTable(
  'lead_updates',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    leadId: uuid('lead_id').notNull(),
    type: leadUpdateType().notNull(),
    /** Rich text, same TipTap-produced HTML convention as task comments. */
    body: text().notNull(),
    /**
     * When the interaction actually happened — NOT when the row was written.
     * Cadence math uses this; created_at would measure data-entry lag instead.
     * Defaults to now() so quick same-day logging needs no extra input.
     */
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    authorId: uuid('author_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // Serves both the timeline render (ordered by occurred_at desc) and the
    // derived last-touch aggregate in §03. Partial on deleted_at IS NULL, so
    // soft-deleted rows are excluded by the index itself rather than filtered
    // after the fact.
    index('idx_lead_updates_lead_occurred')
      .using(
        'btree',
        table.leadId.asc().nullsLast().op('uuid_ops'),
        table.occurredAt.desc().nullsLast().op('timestamptz_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    index('idx_lead_updates_author')
      .using('btree', table.authorId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.leadId],
      foreignColumns: [leads.id],
      name: 'lead_updates_lead_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.id],
      name: 'lead_updates_author_id_fkey',
    }).onDelete('restrict'),
  ]
)
```

### ON DELETE rationale

Project convention requires these to be explicit:

| FK | Behavior | Why |
| --- | --- | --- |
| `lead_id` → `leads.id` | `CASCADE` | Updates are owned children of the lead. Leads soft-delete in practice, so this fires only on a genuine hard delete. Matches `lead_stage_history`. |
| `author_id` → `users.id` | `RESTRICT` | An update is an audit record of who contacted whom. It must not vanish because a user row was removed. Note this is **stricter than `task_comments`**, which cascades on author — a deliberate divergence, since users are disabled (`disabled_at`) rather than deleted in this codebase. |

### Relations

Add to `packages/db/src/relations.ts`, following the existing pattern:

```ts
export const leadUpdatesRelations = relations(leadUpdates, ({ one }) => ({
  lead: one(leads, {
    fields: [leadUpdates.leadId],
    references: [leads.id],
  }),
  author: one(users, {
    fields: [leadUpdates.authorId],
    references: [users.id],
  }),
}))
```

Extend `leadsRelations` with `updates: many(leadUpdates)` and `usersRelations` with
`leadUpdates: many(leadUpdates)`.

### Migration

From `packages/db/`:

```bash
npm run db:generate -- --name lead_updates
```

Review the generated SQL in `packages/db/drizzle/migrations/`, then:

```bash
npm run db:migrate
```

Expected: `CREATE TYPE lead_update_type`, `CREATE TABLE lead_updates`, two indexes, two FK
constraints. **Purely additive — no destructive statements.** If the generated file contains a
`DROP` or `ALTER … DROP`, stop and investigate before applying.

> Do not hand-edit the migration or `meta/_journal.json`. If the SQL is wrong, fix `schema.ts` and
> regenerate.

---

## Constants

New file `apps/internal/lib/leads/updates.ts`, following the shape of
`apps/internal/lib/leads/constants.ts`:

```ts
import { leadUpdateType } from '@/lib/db/schema'

export const LEAD_UPDATE_TYPES = leadUpdateType.enumValues

export type LeadUpdateTypeValue = (typeof LEAD_UPDATE_TYPES)[number]

export const LEAD_UPDATE_LABELS: Record<LeadUpdateTypeValue, string> = {
  MEETING: 'Meeting',
  PHONE_CALL: 'Phone call',
  EMAIL: 'Email',
  NOTE: 'Note',
}

/**
 * Types that count as contact with the lead. NOTE is excluded — an internal
 * observation is not a touch, and counting it would make a lead look recently
 * contacted when nobody reached out. See §03 last-touch derivation.
 */
export const LEAD_TOUCH_TYPES = [
  'MEETING',
  'PHONE_CALL',
  'EMAIL',
] as const satisfies ReadonlyArray<LeadUpdateTypeValue>
```

Type tokens (colors) and icons live in section 03 — they're presentation, and 03 owns the
accessibility requirement that color never carries meaning alone.

---

## Types

Add to `apps/internal/lib/leads/types.ts`:

```ts
export type LeadUpdateRecord = {
  id: string
  leadId: string
  type: LeadUpdateTypeValue
  body: string
  occurredAt: string
  authorId: string
  authorName: string | null
  authorEmail: string | null
  authorAvatarUrl: string | null
  createdAt: string
  updatedAt: string
}
```

Author identity is denormalized into the record the same way `LeadRecord` flattens assignee fields
(`assigneeName` / `assigneeEmail` / `assigneeAvatarUrl`, `types.ts:86-88`) — keeps the timeline from
needing a second round trip per row.

---

## Architecture notes

- **C3 — `occurred_at` must be indexed alongside `lead_id`, not separately.** Both the timeline
  render and the last-touch aggregate filter by lead and order/aggregate by `occurred_at`. A
  composite serves both; two single-column indexes serve neither well.
- **W2 — Author `RESTRICT` diverges from `task_comments`' `CASCADE`.** Intentional, and called out
  above so a future reader doesn't "fix" it for consistency. If a user ever genuinely needs hard
  deletion, that's a migration decision, not a reason to lose audit rows.
- **W3 — No `body` length cap at the database level.** Consistent with `task_comments.body`. The
  server action in 03 enforces a Zod max; if abuse ever matters, add the constraint then.

---

## Acceptance criteria

- [ ] `leadUpdateType` enum added to `packages/db/src/schema.ts` with exactly
      `MEETING`, `PHONE_CALL`, `EMAIL`, `NOTE`.
- [ ] `leadUpdates` table added with all columns, both indexes, and both FKs with the
      `ON DELETE` behaviors specified above.
- [ ] Relations added in `packages/db/src/relations.ts` for the table and both sides
      (`leadsRelations`, `usersRelations`).
- [ ] Migration generated via `npm run db:generate -- --name lead_updates` — **not hand-written**.
- [ ] Generated SQL reviewed and contains **no** `DROP` statements.
- [ ] `npm run db:migrate` applies cleanly against a local database.
- [ ] `apps/internal/lib/leads/updates.ts` exports `LEAD_UPDATE_TYPES`, `LEAD_UPDATE_LABELS`,
      `LEAD_TOUCH_TYPES`, and `LeadUpdateTypeValue`.
- [ ] `LeadUpdateRecord` added to `apps/internal/lib/leads/types.ts`.
- [ ] No RLS: the migration contains no `ENABLE ROW LEVEL SECURITY` and no `CREATE POLICY`.
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root.

---

## Files

**Created**
- `apps/internal/lib/leads/updates.ts`
- `packages/db/drizzle/migrations/00XX_lead_updates.sql` *(generated)*

**Modified**
- `packages/db/src/schema.ts` — enum + table
- `packages/db/src/relations.ts` — three relation blocks
- `apps/internal/lib/leads/types.ts` — `LeadUpdateRecord`
