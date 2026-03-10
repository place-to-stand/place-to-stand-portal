# 02: Data Model

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)
> Phase: **1 — Data Model**
> Dependencies: None — start here

## New Enums

```sql
CREATE TYPE invoice_status AS ENUM (
  'DRAFT',    -- Created but not yet finalized or shared
  'SENT',     -- Finalized and shared with client (invoice number assigned here)
  'VIEWED',   -- Client has opened the public link
  'PAID',     -- Payment confirmed via Stripe webhook
  'VOID'      -- Cancelled / no longer valid
);
```

> **Note on OVERDUE:** Overdue is a computed state, not a stored enum value. Any invoice with `dueDate < NOW()` and `status NOT IN ('PAID', 'VOID')` is considered overdue. This avoids stale status values that require background jobs to keep current.

## Invoice Number Sequence

```sql
CREATE SEQUENCE invoice_number_seq START WITH 1 INCREMENT BY 1;
```

Invoice numbers are formatted as `INV-NNNN` (e.g., `INV-0001`, `INV-0042`). The sequence value is read and formatted in the application layer during the DRAFT→SENT transition:

```typescript
const [{ nextval }] = await db.execute(sql`SELECT nextval('invoice_number_seq')`)
const invoiceNumber = `INV-${String(nextval).padStart(4, '0')}`
```

**Why assign on SENT, not on creation?** Drafts may be abandoned or deleted. Assigning numbers only to finalized invoices prevents gaps in the sequence that would confuse accounting.

## Product Catalog Items Table

```sql
CREATE TABLE product_catalog_items (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,                    -- e.g., "Development Hours"
  description               TEXT,                             -- Optional longer description
  unit_price                NUMERIC(12, 2) NOT NULL,          -- Default price per unit
  unit_label                TEXT NOT NULL DEFAULT 'unit',      -- e.g., "hour", "month", "unit"
  creates_hour_block_default BOOLEAN NOT NULL DEFAULT false,   -- When true, line items from this catalog item default to creating hour blocks on payment
  is_active                 BOOLEAN NOT NULL DEFAULT true,     -- Soft toggle for availability
  sort_order                INTEGER NOT NULL DEFAULT 0,        -- Display ordering
  created_at                TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at                TIMESTAMPTZ                        -- Soft delete
);
```

### Seed Data

The migration includes seed data for common billing items:

```sql
INSERT INTO product_catalog_items (name, description, unit_price, unit_label, creates_hour_block_default, sort_order) VALUES
  ('Development Hours', 'Software development and engineering time', 200.00, 'hour', true, 1),
  ('Server Cost', 'Monthly server hosting and infrastructure', 0.00, 'month', false, 2),
  ('Domain Registration', 'Annual domain name registration', 0.00, 'year', false, 3);
```

> **Note:** Server costs and domain registration have `unit_price = 0.00` because these vary per client. The catalog entry provides the name and unit label; the actual price is set per line item on the invoice.

## Invoices Table

```sql
CREATE TABLE invoices (
  -- Identity
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT UNIQUE,                   -- Assigned on SENT transition (INV-0001 format)
  status          invoice_status NOT NULL DEFAULT 'DRAFT',

  -- Association
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  created_by      UUID REFERENCES users(id),

  -- Dates
  issued_date     DATE,                          -- When the invoice was issued (set on SENT)
  due_date        DATE,                          -- Payment due date

  -- Financial
  subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- Sum of line item amounts
  tax_rate        NUMERIC(5, 4) DEFAULT 0,              -- Tax rate as decimal (0.0875 = 8.75%)
  tax_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,    -- Computed: subtotal * tax_rate
  total           NUMERIC(12, 2) NOT NULL DEFAULT 0,    -- subtotal + tax_amount
  notes           TEXT,                                  -- Optional notes displayed on invoice

  -- Sharing (proposals pattern)
  share_token     VARCHAR(64) UNIQUE,            -- Random hex token for public link
  share_enabled   BOOLEAN NOT NULL DEFAULT false, -- Gate: token exists but can be toggled
  viewed_at       TIMESTAMPTZ,                   -- Last view timestamp
  viewed_count    INTEGER NOT NULL DEFAULT 0,     -- Running tally

  -- Stripe
  stripe_checkout_session_id  TEXT,              -- Stripe Checkout Session ID
  stripe_payment_intent_id    TEXT,              -- Stripe PaymentIntent ID (from webhook)
  paid_at                     TIMESTAMPTZ,       -- When payment was confirmed (from webhook)

  -- Standard timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at      TIMESTAMPTZ                    -- Soft delete
);
```

### Key Design Decisions

**`client_id` ON DELETE RESTRICT**: Invoices are financial records. Deleting a client with outstanding invoices should be blocked, not silently cascade. This differs from hour blocks (which CASCADE) because invoices carry payment and tax data.

**`invoice_number` assigned on transition**: The number is NULL for drafts. It's assigned atomically during the DRAFT→SENT transition using the PostgreSQL SEQUENCE. Once assigned, it never changes.

**Tax fields**: Full tax UI in v1. The admin enters a tax rate as a percentage (e.g., `8.75` in the form), which is stored as a decimal (`0.0875` in the DB). The conversion is: `storedRate = displayRate / 100`. Tax amount is computed as `subtotal * taxRate`. Default is `0` (no tax).

**Sharing columns**: Mirror the proposals pattern exactly. Same column names, same types, same behavioral semantics.

## Invoice Line Items Table

```sql
CREATE TABLE invoice_line_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_catalog_item_id UUID REFERENCES product_catalog_items(id) ON DELETE SET NULL,

  description             TEXT NOT NULL,                  -- Line item description
  quantity                NUMERIC(8, 2) NOT NULL,         -- Number of units
  unit_price              NUMERIC(12, 2) NOT NULL,        -- Price per unit
  amount                  NUMERIC(12, 2) NOT NULL,        -- Computed: quantity * unit_price
  sort_order              INTEGER NOT NULL DEFAULT 0,      -- Display ordering within invoice

  -- Hour block automation
  creates_hour_block      BOOLEAN NOT NULL DEFAULT false,  -- When true, creates hour block on payment

  -- Standard timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at              TIMESTAMPTZ                      -- Soft delete
);
```

### Key Design Decisions

**`invoice_id` ON DELETE CASCADE**: Line items are owned children of invoices. Deleting an invoice (hard delete from archive) removes its line items.

**`product_catalog_item_id` ON DELETE SET NULL**: If a catalog item is removed, existing line items preserve their description and pricing but lose the catalog reference. Historical data is preserved.

**`creates_hour_block`**: This boolean flag marks which line items should trigger hour block creation when the invoice is paid. Typically true for "Development Hours" line items, false for server costs and incidentals. The flag is set during invoice creation based on the catalog item or manually by the admin.

**`amount` stored, not computed**: While `amount = quantity * unit_price` is the formula, we store the computed value to avoid floating-point precision issues in aggregate queries and to preserve the exact amount at time of invoicing.

## Hour Blocks Table Modification

Add `invoice_id` and `invoice_line_item_id` foreign keys to the existing `hour_blocks` table:

```sql
ALTER TABLE hour_blocks
  ADD COLUMN invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  ADD COLUMN invoice_line_item_id UUID REFERENCES invoice_line_items(id) ON DELETE SET NULL;

CREATE INDEX idx_hour_blocks_invoice_id
  ON hour_blocks (invoice_id)
  WHERE deleted_at IS NULL AND invoice_id IS NOT NULL;

-- Ensures one hour block per line item per invoice (idempotency guard)
CREATE UNIQUE INDEX idx_hour_blocks_invoice_line_item_unique
  ON hour_blocks (invoice_line_item_id)
  WHERE deleted_at IS NULL AND invoice_line_item_id IS NOT NULL;
```

**ON DELETE SET NULL**: If an invoice or line item is hard-deleted, the hour block record survives but loses the reference. Hour blocks represent purchased hours — they shouldn't disappear when invoice records are cleaned up.

**`invoice_line_item_id` with unique index**: This serves two purposes:
1. **Traceability** — when an invoice has multiple "Development Hours" line items (e.g., Phase 1: 20hrs, Phase 2: 10hrs), each hour block can be traced back to its specific line item
2. **Idempotency** — the unique partial index prevents duplicate hour blocks from concurrent webhook deliveries (INSERT fails with conflict instead of creating duplicates)

The existing `invoice_number` text field is preserved for backwards compatibility with manually-entered records. New hour blocks created by the automation will have `invoiceId` (FK), `invoiceLineItemId` (FK), and `invoiceNumber` (copied string for display).

## Indexes

```sql
-- Invoices
CREATE INDEX idx_invoices_client_id
  ON invoices (client_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_invoices_status
  ON invoices (status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_invoices_created_by
  ON invoices (created_by)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_invoices_share_token
  ON invoices USING btree (share_token)
  WHERE deleted_at IS NULL AND share_token IS NOT NULL AND share_enabled = true;

CREATE INDEX idx_invoices_stripe_checkout_session
  ON invoices (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- Invoice Line Items
CREATE INDEX idx_invoice_line_items_invoice_id
  ON invoice_line_items (invoice_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_invoice_line_items_product_catalog
  ON invoice_line_items (product_catalog_item_id)
  WHERE deleted_at IS NULL AND product_catalog_item_id IS NOT NULL;

-- Product Catalog
CREATE INDEX idx_product_catalog_items_active
  ON product_catalog_items (sort_order)
  WHERE deleted_at IS NULL AND is_active = true;
```

All business-data indexes follow the codebase convention of partial indexes with `WHERE deleted_at IS NULL`, with one intentional exception noted below.

The `share_token` index mirrors the proposals pattern — only indexes tokens where sharing is actually enabled.

The `stripe_checkout_session_id` index intentionally omits `deleted_at IS NULL` and only filters on `stripe_checkout_session_id IS NOT NULL`. This supports Stripe webhook lookups — finding the invoice from the session ID even if the invoice has been soft-deleted mid-checkout (see [03-stripe-integration.md](./03-stripe-integration.md), "Archived Invoice Handling").

## Drizzle Schema

In `lib/db/schema.ts`:

```typescript
// Enum
export const invoiceStatus = pgEnum('invoice_status', [
  'DRAFT',
  'SENT',
  'VIEWED',
  'PAID',
  'VOID',
])

// Product Catalog
export const productCatalogItems = pgTable(
  'product_catalog_items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    description: text(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    unitLabel: text('unit_label').notNull().default('unit'),
    createsHourBlockDefault: boolean('creates_hour_block_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_product_catalog_items_active')
      .using('btree', table.sortOrder.asc())
      .where(sql`(deleted_at IS NULL AND is_active = true)`),
  ]
)

// Invoices
export const invoices = pgTable(
  'invoices',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    invoiceNumber: text('invoice_number').unique(),
    status: invoiceStatus().notNull().default('DRAFT'),
    clientId: uuid('client_id').notNull(),
    createdBy: uuid('created_by'),
    issuedDate: date('issued_date'),
    dueDate: date('due_date'),
    subtotal: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).default('0'),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    notes: text(),
    shareToken: varchar('share_token', { length: 64 }).unique(),
    shareEnabled: boolean('share_enabled').notNull().default(false),
    viewedAt: timestamp('viewed_at', { withTimezone: true, mode: 'string' }),
    viewedCount: integer('viewed_count').notNull().default(0),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_invoices_client_id')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_invoices_status')
      .using('btree', table.status.asc())
      .where(sql`(deleted_at IS NULL)`),
    index('idx_invoices_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_invoices_share_token')
      .using('btree', table.shareToken.asc())
      .where(
        sql`(deleted_at IS NULL AND share_token IS NOT NULL AND share_enabled = true)`
      ),
    index('idx_invoices_stripe_checkout_session')
      .using('btree', table.stripeCheckoutSessionId.asc())
      .where(sql`(stripe_checkout_session_id IS NOT NULL)`),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'invoices_client_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'invoices_created_by_fkey',
    }),
  ]
)

// Invoice Line Items
export const invoiceLineItems = pgTable(
  'invoice_line_items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    productCatalogItemId: uuid('product_catalog_item_id'),
    description: text().notNull(),
    quantity: numeric({ precision: 8, scale: 2 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createsHourBlock: boolean('creates_hour_block').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_invoice_line_items_invoice_id')
      .using('btree', table.invoiceId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_invoice_line_items_product_catalog')
      .using('btree', table.productCatalogItemId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND product_catalog_item_id IS NOT NULL)`),
    foreignKey({
      columns: [table.invoiceId],
      foreignColumns: [invoices.id],
      name: 'invoice_line_items_invoice_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.productCatalogItemId],
      foreignColumns: [productCatalogItems.id],
      name: 'invoice_line_items_product_catalog_item_id_fkey',
    }).onDelete('set null'),
  ]
)
```

In `lib/db/relations.ts`, add relations:

```typescript
// Invoices
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  creator: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
  }),
  lineItems: many(invoiceLineItems),
}))

// Invoice Line Items
export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
  productCatalogItem: one(productCatalogItems, {
    fields: [invoiceLineItems.productCatalogItemId],
    references: [productCatalogItems.id],
  }),
}))

// Product Catalog Items
export const productCatalogItemsRelations = relations(productCatalogItems, ({ many }) => ({
  lineItems: many(invoiceLineItems),
}))

// Add to existing hour blocks relations
export const hourBlocksRelations = relations(hourBlocks, ({ one }) => ({
  // ... existing relations ...
  invoice: one(invoices, {
    fields: [hourBlocks.invoiceId],
    references: [invoices.id],
  }),
}))
```

## Hour Blocks Schema Modification

Add to the existing `hourBlocks` table definition in `lib/db/schema.ts`:

```typescript
// Add these columns to the existing hourBlocks table
invoiceId: uuid('invoice_id'),
invoiceLineItemId: uuid('invoice_line_item_id'),

// Add these indexes to the existing hourBlocks table indexes
index('idx_hour_blocks_invoice_id')
  .using('btree', table.invoiceId.asc().nullsLast().op('uuid_ops'))
  .where(sql`(deleted_at IS NULL AND invoice_id IS NOT NULL)`),
uniqueIndex('idx_hour_blocks_invoice_line_item_unique')
  .on(table.invoiceLineItemId)
  .where(sql`(deleted_at IS NULL AND invoice_line_item_id IS NOT NULL)`),

// Add these foreign keys
foreignKey({
  columns: [table.invoiceId],
  foreignColumns: [invoices.id],
  name: 'hour_blocks_invoice_id_fkey',
}).onDelete('set null'),
foreignKey({
  columns: [table.invoiceLineItemId],
  foreignColumns: [invoiceLineItems.id],
  name: 'hour_blocks_invoice_line_item_id_fkey',
}).onDelete('set null'),
```

## Behavioral Rules

### Invoice Number Assignment

Invoice numbers are assigned exactly once during the DRAFT→SENT transition:

1. Read next value from `invoice_number_seq`
2. Format as `INV-NNNN` (zero-padded to 4 digits)
3. Set `invoiceNumber`, `status = 'SENT'`, `issuedDate = today`
4. This is atomic — if the update fails, the sequence value is lost (acceptable gap)

Once assigned, the invoice number **never changes**, even if the invoice is voided.

### Status Transitions

Valid transitions:

```
DRAFT → SENT       (assign number, set issued date, enable sharing)
SENT  → VIEWED     (on first client view via public link)
SENT  → PAID       (Stripe webhook only)
VIEWED → PAID      (Stripe webhook only)
DRAFT → VOID       (cancel before sending)
SENT  → VOID       (cancel after sending)
VIEWED → VOID      (cancel after client viewed)
```

Invalid transitions:
- `PAID → *` (paid invoices are immutable)
- `VOID → *` (voided invoices are immutable)
- `* → DRAFT` (no reverting to draft)

### Editability Rules

- **DRAFT**: Fully editable (client, line items, tax, notes, due date)
- **SENT**: Editable (the client hasn't seen it yet). Editing a SENT invoice invalidates any existing Stripe Checkout session (`stripeCheckoutSessionId` is cleared), recalculates totals, and logs an `INVOICE_UPDATED` activity event. The invoice number and share token are preserved.
- **VIEWED**: Locked. The client has seen the invoice — editing it would create a discrepancy between what they saw and what they'd pay. To change, void and create a new invoice.
- **PAID**: Locked. Financial record is immutable.
- **VOID**: Locked. Cancelled record is immutable.

### Totals Computation

When line items are added, updated, or removed:

1. `lineItem.amount = lineItem.quantity * lineItem.unitPrice`
2. `invoice.subtotal = SUM(lineItems.amount)` where `deletedAt IS NULL`
3. `invoice.taxAmount = invoice.subtotal * invoice.taxRate`
4. `invoice.total = invoice.subtotal + invoice.taxAmount`

This computation happens in the save action, not via database triggers.

**Tax rate conversion:** The form displays the tax rate as a human-readable percentage (e.g., `8.75`). The database stores it as a decimal (e.g., `0.0875`). The conversion is:
- **Form → DB:** `storedRate = displayRate / 100`
- **DB → Form:** `displayRate = storedRate * 100`

This must be handled explicitly in the form's `defaultValues` and the save action's payload builder to avoid off-by-100x bugs.

### Soft Delete Cascade

When an invoice is soft-deleted (archived):
- The invoice's `deletedAt` is set
- Line items are NOT soft-deleted (they're hidden by the invoice being archived)
- Line items are only relevant when queried via their parent invoice

When an invoice is hard-deleted (destroyed from archive):
- The database CASCADE deletes line items automatically

## Migration

Generate with: `npm run db:generate -- --name add_invoicing`

The migration should:
1. Create `invoice_status` enum
2. Create `product_catalog_items` table
3. Create `invoices` table
4. Create `invoice_line_items` table
5. Create `invoice_number_seq` sequence
6. Add `invoice_id` column to `hour_blocks`
7. Create all indexes
8. Seed product catalog items

## Implementation Checklist (Phase 1)

1. Add `invoiceStatus` enum to `lib/db/schema.ts`
2. Add `productCatalogItems` table to `lib/db/schema.ts`
3. Add `invoices` table to `lib/db/schema.ts`
4. Add `invoiceLineItems` table to `lib/db/schema.ts`
5. Add `invoiceId` column to existing `hourBlocks` table
6. Add all relations to `lib/db/relations.ts`
7. Generate migration: `npm run db:generate -- --name add_invoicing`
8. Add product catalog seed data to migration
9. Review generated SQL in `drizzle/migrations/`
10. Apply locally: `npm run db:migrate`
