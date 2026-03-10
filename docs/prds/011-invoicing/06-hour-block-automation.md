# 06: Hour Block Automation

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)
> Phase: **5 — Hour Block Automation**
> Dependencies: Phase 1 (data model), Phase 2 (Stripe webhook handler)

## Overview

When a client pays an invoice via Stripe, the system automatically creates hour block records for line items flagged with `createsHourBlock = true`. This closes the loop: Invoice → Payment → Hour Block → visible on client dashboard.

## Line Item Flagging

### Which line items create hour blocks?

The `creates_hour_block` boolean on `invoice_line_items` determines which line items trigger hour block creation on payment.

**Auto-set from product catalog:** When a line item is created from a product catalog item, the flag is set based on the catalog item. For v1, only "Development Hours" auto-sets this flag.

**Manually overridable:** The admin can toggle this flag in the invoice sheet for any line item. This handles edge cases like:
- A custom line item that represents prepaid hours
- A development hours line item that should NOT create an hour block (e.g., it's a correction)

### What data flows to the hour block?

| Hour Block Field | Source |
|------------------|--------|
| `clientId` | `invoice.clientId` |
| `hoursPurchased` | `lineItem.quantity` |
| `invoiceId` | `invoice.id` (FK) |
| `invoiceLineItemId` | `lineItem.id` (FK, unique — idempotency guard) |
| `invoiceNumber` | `invoice.invoiceNumber` (copied string for display) |
| `createdBy` | `invoice.createdBy` |

## Creation Flow

File: `lib/data/invoices.ts`

```typescript
export async function createHourBlocksFromInvoice(invoiceId: string) {
  // 1. Fetch invoice with line items
  const invoice = await getInvoiceWithLineItems(invoiceId)
  if (!invoice) return

  // 2. Filter to qualifying line items (creates hour block, not deleted, positive quantity)
  const hourBlockItems = invoice.lineItems.filter(
    item => item.createsHourBlock && !item.deletedAt && Number(item.quantity) > 0
  )
  if (hourBlockItems.length === 0) return

  // 3. Insert hour blocks with ON CONFLICT for idempotency
  //    The unique partial index on invoice_line_item_id prevents duplicates
  //    even under concurrent webhook deliveries
  await db.transaction(async tx => {
    for (const item of hourBlockItems) {
      await tx
        .insert(hourBlocks)
        .values({
          clientId: invoice.clientId,
          hoursPurchased: item.quantity,
          invoiceId: invoice.id,
          invoiceLineItemId: item.id,
          invoiceNumber: invoice.invoiceNumber,
          createdBy: invoice.createdBy,
        })
        .onConflictDoNothing({
          target: hourBlocks.invoiceLineItemId,
        })
    }
  })

  // 4. Log activity for each created hour block
  for (const item of hourBlockItems) {
    logHourBlockCreatedFromInvoice(
      invoice.id,
      invoice.invoiceNumber,
      item.quantity,
      invoice.clientId
    ).catch(console.error)
  }
}
```

### Idempotency

The function uses `INSERT ... ON CONFLICT DO NOTHING` on the unique partial index `idx_hour_blocks_invoice_line_item_unique` (on `invoice_line_item_id WHERE deleted_at IS NULL`). This handles all retry scenarios:

1. First delivery: inserts hour blocks normally
2. Second delivery: ON CONFLICT skips all inserts (no-op)
3. Concurrent deliveries: the unique index prevents duplicates at the database level — no TOCTOU race condition

This is more robust than the SELECT-then-INSERT pattern because it's atomic. There's no window between checking and inserting where a concurrent request could slip through.

### Multiple Line Items

An invoice can have multiple line items flagged for hour block creation. Each creates a separate hour block record. For example:

| Line Item | Qty | Creates HB? |
|-----------|-----|-------------|
| Development Hours (Phase 1) | 20 | ✓ → creates 20-hour block |
| Development Hours (Phase 2) | 10 | ✓ → creates 10-hour block |
| Server Hosting | 1 | ✗ |

This results in two hour block records, both linked to the same invoice.

## Hour Block Display Enhancement

On the hour blocks list and client detail pages, hour blocks created from invoices show:
- The invoice number as a link (if the invoice exists)
- "Auto-created from invoice INV-0042" in the activity feed

This provides traceability from hour block back to the invoice that generated it.

## Edge Cases

### Invoice voided after payment
- Not possible: PAID → VOID is an invalid transition (see [02-data-model.md](./02-data-model.md))
- Once paid, the invoice and its hour blocks are permanent

### Invoice hard-deleted after payment
- Hour blocks have `ON DELETE SET NULL` on the `invoiceId` FK
- The hour blocks survive but lose the invoice reference
- The `invoiceNumber` string field preserves the reference for display

### Line item has quantity 0
- Skip hour block creation for items with `quantity <= 0`
- Log a warning for debugging

### Client deleted
- Hour blocks CASCADE on client delete, so they're removed
- The invoice has RESTRICT on client delete, so this scenario requires archiving the invoice first

## Activity Events

When hour blocks are auto-created from an invoice payment, log:

```typescript
// For each created hour block:
{
  verb: 'HOUR_BLOCK_CREATED',
  summary: `Auto-created ${hours}-hour block from invoice ${invoiceNumber}`,
  targetType: 'HOUR_BLOCK',
  targetId: hourBlockId,
  targetClientId: clientId,
  metadata: {
    source: 'invoice_payment',
    invoiceId,
    invoiceNumber,
    hours,
  },
}
```

This reuses the existing `HOUR_BLOCK_CREATED` verb with additional metadata indicating the source.

## Implementation Checklist (Phase 5)

1. Create `createHourBlocksFromInvoice()` in `lib/data/invoices.ts` using ON CONFLICT pattern
2. Wire into `handleCheckoutCompleted()` webhook handler
3. Add invoice link display to hour blocks table (optional enhancement)
4. Test idempotency: trigger webhook twice, verify single set of hour blocks
5. Test with multiple qualifying line items
6. Test with zero qualifying line items (no hour blocks created)
7. Test concurrent webhook deliveries don't create duplicate hour blocks
