# 01 — Schema: Acknowledgement Columns + Migration

**Depends on:** nothing
**Blocks:** [03-acknowledge-unread.md](03-acknowledge-unread.md), [06-nav-unread-badge.md](06-nav-unread-badge.md)
**Decisions:** D1, D7, D8 (see [README](README.md))

## Problem statement

`form_submissions` has no way to record that a human has seen a row. The table already soft-deletes via `deleted_at` (archive needs no schema change), but "unread" state — the core of D1/D2 — has nowhere to live. Additionally, the beacon upsert can advance a row's status *after* it has been acknowledged (an acknowledged `completed` audit later becomes `captured` when a late beacon delivers contact info), and that transition must re-flag the row (D8).

## Fix description

Add two nullable columns to `formSubmissions` in `packages/db/src/schema.ts`, a partial index sized for the unread-count query, a hand-added backfill, and a guard in the intake upsert that clears acknowledgement when status advances.

## Implementation details

### 1. Schema (`packages/db/src/schema.ts`)

Inside the `formSubmissions` `pgTable` (after the `deletedAt` column block, before the table-config callback), add:

```ts
    // Acknowledgement — a human has reviewed this row from the Submissions
    // screen. NULL = unread (for rows that warrant attention; see the unread
    // predicate in apps/internal/lib/form-submissions/constants.ts). Cleared
    // by the intake upsert when status advances, so an acknowledged
    // `completed` audit that later becomes `captured` re-flags as unread.
    acknowledgedAt: timestamp('acknowledged_at', {
      withTimezone: true,
      mode: 'string',
    }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id, {
      onDelete: 'set null',
    }),
```

Conventions honored: `mode: 'string'` timestamps like the rest of the table; explicit `ON DELETE SET NULL` (optional audit reference — users are soft-deleted anyway, this is belt-and-braces).

In the table-config callback, add a partial index matching the unread-count query (section 06):

```ts
    index('idx_form_submissions_unread')
      .using(
        'btree',
        table.kind.asc().nullsLast().op('enum_ops'),
        table.status.asc().nullsLast().op('enum_ops')
      )
      .where(sql`(deleted_at IS NULL AND acknowledged_at IS NULL)`),
```

### 1b. Relations (W3 — [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

`packages/db/src/relations.ts` currently has no `formSubmissions` entry. Per the project migration workflow (schema changes land in `schema.ts` *and* `relations.ts`), declare the new FK's relation:

```ts
export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  acknowledgedByUser: one(users, {
    fields: [formSubmissions.acknowledgedBy],
    references: [users.id],
  }),
}))
```

Nothing traverses it yet (the detail sheet shows the timestamp only — resolving the acknowledger's name is future scope), but this keeps `db.query.formSubmissions.with(...)` available and the convention checklist honest.

### 2. Migration

From `packages/db/`:

```bash
npm run db:generate -- --name form_submission_acknowledgement
```

Review the generated SQL in `packages/db/drizzle/migrations/00XX_form_submission_acknowledgement.sql` (next number after `0053_form_submissions.sql`). It should contain only: two `ALTER TABLE … ADD COLUMN`, one `ADD CONSTRAINT … FOREIGN KEY`, one `CREATE INDEX`. This is add-only — no interactive rename prompt, so no `expect`/TTY workaround is needed.

**Hand-append the D7 backfill** to the generated migration file:

```sql
-- Backfill: treat everything that predates the acknowledgement feature as
-- read, so the unread badge starts at 0 instead of counting historical rows.
UPDATE "form_submissions"
SET "acknowledged_at" = timezone('utc'::text, now())
WHERE "deleted_at" IS NULL;
```

(`acknowledged_by` stays NULL for backfilled rows — no user performed the action.)

Apply locally: `npm run db:migrate` (from `packages/db/` or `apps/internal/` with `DATABASE_URL` set).

### 3. Intake upsert guard (D8) — `apps/internal/lib/queries/form-submissions.ts`

In `upsertFormSubmission`'s `onConflictDoUpdate.set`, add (alongside the existing field policies, documented in the same comment style):

```ts
        // Acknowledgement resets when status advances: a reviewed row that
        // gains new signal (completed -> captured is the one that matters)
        // must re-flag as unread. Status can only advance (GREATEST above),
        // so a strict > comparison is exactly "advanced".
        acknowledgedAt: sql`
          CASE
            WHEN excluded.status > ${formSubmissions.status}
              THEN NULL
            ELSE ${formSubmissions.acknowledgedAt}
          END
        `,
        acknowledgedBy: sql`
          CASE
            WHEN excluded.status > ${formSubmissions.status}
              THEN NULL
            ELSE ${formSubmissions.acknowledgedBy}
          END
        `,
```

Notes:

- `excluded.status > form_submissions.status` compares by enum declaration order — the same mechanism the `GREATEST` status rule relies on. The schema comment already forbids reordering enum values.
- The `setWhere` stale-beacon gate already discards out-of-order beacons before this runs; a stale beacon can never clear an acknowledgement.
- Contact submissions never conflict (unique one-shot `session_key`), so this is a no-op for them — consistent with the existing "every rule is a no-op for contacts" contract in the function's doc comment. Update that doc comment to mention the acknowledgement rule.

### 4. Type flow

`FormSubmission` / `NewFormSubmission` in `@pts/db/types` are Drizzle-inferred — they pick up `acknowledgedAt`/`acknowledgedBy` automatically. `FormSubmissionRecord` (`apps/internal/lib/form-submissions/types.ts`) spreads the row, so no change there. There is no snake-case `Db*` twin for this table in `apps/internal/lib/types.ts` — verified, nothing to mirror.

## Acceptance criteria

- [ ] `formSubmissions` schema has `acknowledgedAt` (timestamptz, nullable) and `acknowledgedBy` (uuid, nullable, FK → users, `ON DELETE SET NULL`)
- [ ] Partial index `idx_form_submissions_unread` exists with `WHERE (deleted_at IS NULL AND acknowledged_at IS NULL)`
- [ ] W3: `formSubmissionsRelations` declared in `packages/db/src/relations.ts` (acknowledgedByUser)
- [ ] Generated migration reviewed; backfill statement hand-appended; `npm run db:migrate` applies cleanly
- [ ] After migration, every pre-existing non-deleted row has `acknowledged_at` set (badge math starts at 0)
- [ ] `upsertFormSubmission` clears `acknowledged_at` and `acknowledged_by` when and only when `excluded.status` advances past the stored status
- [ ] A stale beacon (older `last_activity_at`) does not modify acknowledgement (existing `setWhere` gate covers it)
- [ ] Doc comment on `upsertFormSubmission` updated with the acknowledgement rule
- [ ] No `pgPolicy`, no RLS, no `CREATE POLICY` anywhere in the migration (project rule)
- [ ] `npm run build && npm run lint && npm run type-check` pass from repo root

## Files likely modified / created

- `packages/db/src/schema.ts` (modified)
- `packages/db/src/relations.ts` (modified — W3)
- `packages/db/drizzle/migrations/00XX_form_submission_acknowledgement.sql` (generated + hand-edited)
- `apps/internal/lib/queries/form-submissions.ts` (modified — upsert guard)
