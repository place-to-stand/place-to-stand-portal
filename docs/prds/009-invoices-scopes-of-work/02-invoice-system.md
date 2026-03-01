# 02: Invoice System

> Part of [PRD 009: Invoices & Scopes of Work](./README.md)
> Related: [03-stripe-and-payments.md](./03-stripe-and-payments.md) | [04-monthly-billing-cron.md](./04-monthly-billing-cron.md) | [07-data-model-reference.md](./07-data-model-reference.md)

## Billing Models

The portal supports two client billing types (existing `billing_type` enum on `clients`):

| Model | How It Works | Invoice Trigger |
|-------|-------------|-----------------|
| **Prepaid** | Client purchases hour blocks upfront. Work draws down from the balance. | Admin creates invoice manually when client requests more hours. |
| **Net 30** | Client is billed monthly for actual hours worked. Payment due within 30 days. | Automated on the 1st of each month via Vercel Cron (draft for review). |

## Invoice Statuses (`invoice_status` enum)

| Status | Description |
|--------|-------------|
| `DRAFT` | Created but not yet shared with client. |
| `SENT` | Share link enabled and sent to client (email or link copy). |
| `VIEWED` | Client opened the shared invoice page. **Guard:** Only transition to VIEWED if current status is `SENT`. If already `PAID` or later, skip to prevent race with payment webhook. |
| `PAID` | Payment received and confirmed via Stripe webhook. |
| `PARTIALLY_PAID` | Only via manual admin override (e.g., partial wire transfer). Stripe PaymentIntents are all-or-nothing. |
| `REFUNDED` | Full refund via Stripe (`charge.refunded` webhook). Partial refunds logged but don't change status. |
| `VOID` | Cancelled/voided. |

**`OVERDUE` is computed, not stored.** An invoice is overdue when `due_date < NOW() AND status NOT IN ('PAID', 'VOID', 'REFUNDED')`. Avoids needing a background job to transition statuses.

**Immutability rule:** Invoices in terminal states (`PAID`, `VOID`, `REFUNDED`) are immutable — line items, totals, and `client_id` cannot be modified. Only `notes` can be updated on void invoices. Enforce in the application layer.

## Line Items (`line_item_type` enum)

| Type | Use Case |
|------|----------|
| `HOURS_PREPAID` | Prepaid hour block purchase (e.g., "10 hours @ $X/hr"). |
| `HOURS_WORKED` | Net-30 billable hours for the period. |
| `CUSTOM` | Any additional charge — server hosting, CMS fees, one-off charges, credits, adjustments. |

**No dedicated incidentals table.** Recurring costs like server hosting or CMS fees are added as `CUSTOM` line items directly on the invoice. Admins add whatever line items are needed when creating or editing a draft.

**Hour block linkage:** `invoice_line_items.hour_block_id` FK is the canonical link between a line item and the hour block it purchased. Navigate from hour block → line item → invoice through the `hour_block_id` FK (no bidirectional FK on `hour_blocks`).

## Prepaid Hour Block Defaults

- **Default quantity**: 5 hours (pre-filled in UI).
- **Minimum**: Configurable per-client or globally. Start with 5-hour minimum.
- **Emergency override**: Admin can manually set quantity to 1 hour (UI confirmation required).
- **Common presets**: Quick-select buttons for 5, 10, 20, and 40 hours.

**Prepaid flow:**
1. Admin selects client, chooses hours (defaults to 5).
2. Invoice created with a single `HOURS_PREPAID` line item.
3. Admin can add additional `CUSTOM` line items as needed.
4. On send → status moves to `SENT`.
5. On payment → status moves to `PAID`, `hour_block` record auto-created. Line item's `hour_block_id` set to the new hour block.

## Invoice Settings (`billing_settings` singleton)

A settings tab at `/invoices/settings` for configuring billing defaults:

- **Hourly rate**: Single global rate, starting at $200/hr.
- **Company info**: Name, logo, address displayed on public invoice page.
- **Payment terms**: Default due date offset (e.g., "Net 30" = 30 days).
- **Invoice number prefix**: Default "INV" with year, configurable.

**Singleton pattern:** CHECK constraint on `id` ensures only one row. Writes use `INSERT ... ON CONFLICT (id) DO UPDATE`. Fixed UUID defined as constant:

```typescript
// lib/billing/constants.ts
export const BILLING_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'
```

**Seeded in migration.** The singleton row is inserted as part of the migration.

**Future per-client rates:** Add `hourly_rate` to `clients` table, resolve with `COALESCE(client.hourly_rate, billing_settings.hourly_rate)`. Line items already store `unit_price` per row, so historical invoices are unaffected.

## Invoice Number Generation

Format: `INV-2026-0001`. Must be unique and monotonically increasing.

**PostgreSQL SEQUENCE:**
```sql
CREATE SEQUENCE invoice_number_seq START WITH 1;
```

Number assigned on **DRAFT → SENT transition** (not on creation):
```typescript
const [{ nextVal }] = await db.execute(sql`SELECT nextval('invoice_number_seq')`)
const invoiceNumber = `${prefix}-${year}-${String(nextVal).padStart(4, '0')}`
```

UNIQUE constraint on `invoice_number` as safety net. Drafts have `NULL` invoice_number.

**Year rollover:** SEQUENCE is global (not per-year). Numbers are continuous across years (e.g., `INV-2026-0042`, then `INV-2027-0043`). The year indicates when sent, not a per-year counter.

## Invoice UI

**Replaces Hour Blocks screen.** `/invoices` route in the Sales sidebar section (admin-only). Clients pay via public share links.

**Views:**
- **Invoice list**: Table with invoice number, client, status, total, due date, sent date, paid date. Filterable by status and client.
- **Invoice detail/editor**: Sheet or page showing line items, totals, client info, action buttons (Send, Mark Paid, Void).
- **Create invoice**: Sheet form — select client, billing type auto-detected, pre-populated line items. Prepaid defaults to 5 hours with preset buttons.
- **Duplicate invoice**: Action on any existing invoice to create a new draft with same line items (excluding soft-deleted items, clearing `hour_block_id` references).
- **Hour block history**: Invoice detail for prepaid invoices shows linked hour block via `invoice_line_items.hour_block_id`.

**Legacy data migration:**
- Existing hour block records remain untouched.
- Old Hour Blocks settings page is removed.
- Historical hour blocks visible via client detail page or read-only "Legacy Hour Blocks" section.

**Dashboard integration:**
- Monthly revenue widget on main dashboard.
- Outstanding invoices count badge.
- Overdue invoice alerts.
