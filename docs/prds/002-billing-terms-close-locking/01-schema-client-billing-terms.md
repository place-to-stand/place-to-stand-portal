# 01 — `client_billing_terms`: schema, backfill, billing change flow

Effective-dated history of each client's billing type, plus the admin flow that writes it. The monthly close resolves billing type *as of the report month* from this table (section 02); `clients.billing_type` remains the denormalized **current** cache for UI display, invoice defaults, and lead conversion (D2).

Core semantics (D10): **a billing change applies when saved** — the cache flips in the save transaction; the terms row's `effective_from` month boundary controls only which basis the report resolves per month. "Switch Acme to prepaid from September" saved Aug 6 means: sheet and invoice defaults say prepaid today, August still closes as net_30 from time logs, September onward closes as prepaid from hour blocks.

## Table definition

Add to `packages/db/src/schema.ts` (reusing the existing `clientBillingType` enum):

```ts
export const clientBillingTerms = pgTable(
  'client_billing_terms',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clientId: uuid('client_id').notNull(),
    billingType: clientBillingType('billing_type').notNull(),
    /** First day of the month this billing type takes effect (month-start CHECK). */
    effectiveFrom: date('effective_from').notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // One active term per client per boundary; re-editing a boundary upserts.
    uniqueIndex('uq_client_billing_terms_client_effective')
      .on(table.clientId, table.effectiveFrom)
      .where(sql`(deleted_at IS NULL)`),
    // Resolution path: latest effective_from <= period start for a client.
    index('idx_client_billing_terms_resolution')
      .using('btree', table.clientId.asc(), table.effectiveFrom.desc())
      .where(sql`(deleted_at IS NULL)`),
  ]
)
```

Foreign keys (explicit ON DELETE per project convention): `client_id` → `clients.id` **RESTRICT**; `created_by` → `users.id` **SET NULL**.

Relations in `packages/db/src/relations.ts`: `clientBillingTerms` → one `client`, one `createdByUser`; `clients` → many `billingTerms`.

**No RLS. No `pgPolicy()`.** No `DbClient` snake-case twin changes — `clients` is untouched; the new table is consumed via Drizzle-inferred types (`@pts/db`).

## Hand-added migration SQL

`npm run db:generate -- --name client_billing_terms` from `packages/db/`, then hand-add:

```sql
-- Preflight (F10): the sentinel must predate all report-driving data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "time_logs" WHERE "logged_on" < DATE '2000-01-01')
     OR EXISTS (SELECT 1 FROM "hour_blocks" WHERE "created_at" < TIMESTAMPTZ '2000-01-01')
  THEN
    RAISE EXCEPTION 'client_billing_terms backfill sentinel 2000-01-01 does not predate existing data';
  END IF;
END $$;

-- Month-start cutovers only (D3): each month is single-basis per client.
ALTER TABLE "client_billing_terms"
  ADD CONSTRAINT "chk_client_billing_terms_month_start"
  CHECK ("effective_from" = date_trunc('month', "effective_from")::date);

-- Backfill (D5): one row per existing client — including soft-deleted clients —
-- at a sentinel that predates all data, so every historical month resolves to
-- exactly what it renders today. Zero report drift at migration time.
INSERT INTO "client_billing_terms" ("client_id", "billing_type", "effective_from")
SELECT "id", "billing_type", DATE '2000-01-01'
FROM "clients";
```

Do **not** backfill with each client's `created_at` — clients created mid-history would fail to resolve for months where they already have time logs. Soft-deleted clients are included so a restored client resolves correctly.

## `hour_blocks.billing_month` (F7 — prepaid attribution)

The monthly close attributes prepaid blocks by **creation month**, but blocks can legitimately be created before the client's prepaid boundary — most dangerously by the **Stripe webhook** ([apps/internal/app/api/integrations/stripe/route.ts](../../../apps/internal/app/api/integrations/stripe/route.ts) → `createHourBlocksFromInvoice` in [apps/internal/lib/data/invoices.ts](../../../apps/internal/lib/data/invoices.ts)), which no UI warning can reach. A block created in a net_30-resolving month would never count in any month's Billing In (D13).

Add to the existing `hourBlocks` table in the **same migration**:

```sql
ALTER TABLE "hour_blocks" ADD COLUMN "billing_month" date;
UPDATE "hour_blocks"
  SET "billing_month" = date_trunc('month', "created_at" AT TIME ZONE 'UTC')::date;
ALTER TABLE "hour_blocks" ALTER COLUMN "billing_month" SET NOT NULL;
ALTER TABLE "hour_blocks"
  ADD CONSTRAINT "chk_hour_blocks_billing_month_month_start"
  CHECK ("billing_month" = date_trunc('month', "billing_month")::date);
CREATE INDEX "idx_hour_blocks_billing_month" ON "hour_blocks" ("billing_month")
  WHERE ("deleted_at" IS NULL);
```

(Backfill = creation month, so pre-migration blocks report exactly as today — same zero-drift rule as D5.) Add the column to the `hourBlocks` pgTable in `packages/db/src/schema.ts`.

**Write rule** — shared helper `resolveHourBlockBillingMonth(clientId)` in `apps/internal/lib/queries/clients/billing-terms.ts`, used by **both** write paths (`createHourBlocksFromInvoice` and the manual `save-hour-block.ts` action):

- If the client resolves `prepaid` for the current month → `billing_month = date_trunc('month', now())`.
- Else → the client's earliest prepaid term with `effective_from` > today (i.e. the upcoming boundary) — the block lands in the first month it can actually be billed.
- No prepaid term at all (defensive; shouldn't happen for a block-creating flow) → current month, and log an error.

This **replaces** the pre-boundary purchase warning that section 05 previously specified — the block is simply attributed to the right month instead of warning about the wrong one. Section 02's prepaid queries count by `billing_month` instead of creation month.

## Query module

New file `apps/internal/lib/queries/clients/billing-terms.ts` (`server-only`):

- `insertInitialBillingTerm(tx, { clientId, billingType, createdBy })`
- `upsertBillingTerm({ clientId, billingType, effectiveFrom, createdBy })` — insert, or update `billing_type` on `(client_id, effective_from)` conflict. **The unique index is partial**, so `onConflictDoUpdate` must pass `targetWhere: sql\`deleted_at IS NULL\`` or Postgres won't match it (W3)
- `billingTypeAsOfSql(periodStart)` — the correlated-subquery fragment used by section 02 (defined there)

## Initial terms row on client creation

One insertion point: [apps/internal/lib/settings/clients/actions/create-client.ts](../../../apps/internal/lib/settings/clients/actions/create-client.ts). Lead conversion needs **no separate change** — [convert-lead.ts](../../../apps/internal/lib/leads/actions/convert-lead.ts) creates clients by calling the `createClient` action and inherits the term (W1; test 01.3 verifies).

Insert the term **in the same transaction** as the client insert, with `effective_from = date_trunc('month', now())` (first of the creation month — new clients have no earlier data). `createClient` currently has **no transaction** — it's a slug-retry loop (~lines 68–131) around a bare insert (W2). Restructure: wrap `db.transaction` (client insert + `insertInitialBillingTerm`) *inside* the retry loop — a slug unique-violation aborts the transaction and the loop retries with a fresh slug. A client without a terms row is invisible to every future monthly close (D4).

## Billing change flow (client sheet + update action)

**Sheet UX** ([apps/internal/lib/settings/clients/client-sheet-schema.ts](../../../apps/internal/lib/settings/clients/client-sheet-schema.ts) / form-state):

- Billing type select shows the current (cache) value.
- When the value differs from saved on an **existing** client, reveal a **"New billing starts:"** radio (PW3 — plain wording): **Next month** (default — current month stays single-basis) or **This month** (hint text: "This month's close will re-derive under the new billing type"). Create mode never shows the radio.
- **No in-sheet history list** (W5 resolution) — the activity feed already records every change with before/after and `effectiveFrom`; the sheet stays on the `DbClient` row shape it has today.
- Changed your mind before the boundary? Switch the type back and save — the same boundary row upserts back to the old value. No cancellation concept.

**Zod** ([apps/internal/lib/settings/clients/client-service.ts](../../../apps/internal/lib/settings/clients/client-service.ts)): add `billingEffective: z.enum(['current_month', 'next_month']).default('next_month')` (ignored when the type is unchanged). The server computes the actual date — the month-start CHECK can't be violated by input.

**Update action** ([apps/internal/lib/settings/clients/actions/update-client.ts](../../../apps/internal/lib/settings/clients/actions/update-client.ts)), when `billingType` differs from `existingClient.billingType`:

1. Compute `effectiveFrom` from `billingEffective` (`date_trunc('month', now())` or `+ 1 month`), in UTC.
2. In one transaction: closed-month guard **inside the transaction** (F5 — checking before it leaves a TOCTOU window where a concurrent close slips between check and write), then `upsertBillingTerm(…)` + the existing `db.update(clients)` set-clause, which keeps writing `billingType` unconditionally — that write *is* the cache flip. Guard failure: `'That month's books are closed. Reopen [Month] before changing its billing basis.'` (D9 hard block; only reachable via "This month"). Uses `isMonthClosed` from section 03 — ship behind a stub returning "open" if 03 hasn't landed.

**Activity**: the existing `clientUpdatedEvent` "billing type" diff entry ([apps/internal/lib/activity/events/clients.ts](../../../apps/internal/lib/activity/events/clients.ts) via `calculateDiff` in update-client.ts) gains the boundary in details: `{ billingType: { from, to, effectiveFrom } }`. One event, actor = the saving admin.

**Known edge → solved by `billing_month`** (above, F7): blocks created before a next-month boundary — manually or by the Stripe webhook on invoice payment — are attributed to the client's first prepaid month instead of being lost.

## Deliberately unchanged

- Invoice defaults ([apps/internal/lib/invoices/invoice-options.ts](../../../apps/internal/lib/invoices/invoice-options.ts)) keep reading the cache — always current under D10.
- Lead conversion keeps writing `billingType` (+ initial term above).
- `invoices.billing_type` snapshot column semantics.

## Acceptance criteria

- [ ] Migration applies on a database with existing clients; every client (active + archived) has exactly one terms row at `2000-01-01`
- [ ] Creating a client via settings sheet or lead conversion produces a first-of-current-month terms row, atomically with the client
- [ ] Unique index rejects a duplicate active `(client_id, effective_from)`; CHECK rejects non-month-start dates
- [ ] Changing billing type with "Next month": sheet/list/invoice defaults show the new type immediately; current month's report keeps the old basis; next month uses the new basis
- [ ] "This month": current month's report re-derives under the new basis
- [ ] Switching the type back before the boundary overwrites the same boundary row cleanly
- [ ] "This month" targeting a closed month is blocked with the reopen-first error
- [ ] Activity shows one billing-type change entry with before/after and `effectiveFrom`
- [ ] Every existing hour block backfills `billing_month` = its creation month; a block created (manually or via paid invoice) for a client with a future prepaid boundary gets `billing_month` = the boundary month
- [ ] Migration preflight fails loudly if any data predates the sentinel
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from repo root
