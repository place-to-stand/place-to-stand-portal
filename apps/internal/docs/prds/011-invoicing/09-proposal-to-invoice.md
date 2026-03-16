# 09: Proposal-to-Invoice Conversion

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)
> Phase: **7 — Proposal-to-Invoice**
> Dependencies: Phase 1 (data model), Phase 3 (dashboard UI)

## Overview

A signed/accepted proposal naturally leads to an invoice. This phase adds a "Create Invoice" action on proposals that pre-fills a new invoice from the proposal's data, bridging the Proposal → Invoice → Payment → Hour Block chain described in [01-overview.md](./01-overview.md).

## Conversion Flow

### Trigger

A "Create Invoice" action appears in the proposals table row actions when:
- The proposal is signed/accepted
- The proposal has a client associated with it

### What Gets Pre-Filled

| Invoice Field | Source | Notes |
|---------------|--------|-------|
| `clientId` | Proposal's client | Required — proposals without a client can't convert |
| Line item | Single "Development Hours" line | 5 hours × $200/hr default (minimum billable block) |
| `notes` | Proposal title/reference | e.g., "Per proposal: {proposalTitle}" |
| `dueDate` | Client billing type | net_30 → 30 days from today; prepaid → blank (upon receipt) |
| `proposalId` | Proposal ID | New FK for traceability (see data model addition) |

### Proposal Content → Line Items Mapping

The agency bills in comfortable blocks that the client agrees to, with a **minimum of 5 hours**. Proposals contain phases, deliverables, and an overall hourly rate — but the actual billed amount is a business decision, not a direct mapping from proposal content.

The pre-fill creates a single "Development Hours" line item with the minimum block size as a starting point:

```typescript
function mapProposalToLineItems(proposal: ProposalWithContent): InvoiceLineItemDraft[] {
  const content = proposal.content as ProposalContent
  const hourlyRate = content?.rates?.hourlyRate ?? 200

  return [{
    description: `Development Hours — ${proposal.title}`,
    quantity: 5, // Minimum billable block, admin adjusts to actual
    unitPrice: hourlyRate,
    createsHourBlock: true,
    productCatalogItemId: DEVELOPMENT_HOURS_CATALOG_ID,
  }]
}
```

> **Design rationale:** We intentionally don't try to map proposal phases to line items. The proposal's `estimatedScopingHours` and phase structure are scoping tools, not billing instructions. The admin decides the hour block size based on client conversations, not proposal math. The 5-hour minimum is pre-filled as a reasonable starting point — the admin adjusts up or down before saving.

### User Flow

1. Admin clicks "Create Invoice" on a signed proposal
2. Invoice sheet opens in create mode, pre-filled with proposal data
3. Admin reviews/adjusts line items, quantities, pricing, due date
4. Admin saves the draft invoice
5. Admin sends the invoice when ready (separate action)

This is intentionally a two-step process: create draft, then send. The admin always gets to review before anything goes to the client.

## Data Model Addition

Add an optional `proposalId` FK to the invoices table for traceability:

```sql
ALTER TABLE invoices
  ADD COLUMN proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL;

CREATE INDEX idx_invoices_proposal_id
  ON invoices (proposal_id)
  WHERE deleted_at IS NULL AND proposal_id IS NOT NULL;
```

**ON DELETE SET NULL**: If the proposal is deleted, the invoice survives but loses the reference. Same pattern as `hour_blocks.invoiceId`.

This enables:
- Viewing which invoice was created from which proposal
- Preventing duplicate invoices from the same proposal (optional: show warning if an invoice already exists for this proposal)
- Future reporting on the full Proposal → Invoice → Payment chain

### Drizzle Schema Addition

```typescript
// Add to invoices table columns
proposalId: uuid('proposal_id'),

// Add to invoices table indexes
index('idx_invoices_proposal_id')
  .using('btree', table.proposalId.asc().nullsLast().op('uuid_ops'))
  .where(sql`(deleted_at IS NULL AND proposal_id IS NOT NULL)`),

// Add FK
foreignKey({
  columns: [table.proposalId],
  foreignColumns: [proposals.id],
  name: 'invoices_proposal_id_fkey',
}).onDelete('set null'),
```

### Drizzle Relations Addition

```typescript
// Add to invoicesRelations
proposal: one(proposals, {
  fields: [invoices.proposalId],
  references: [proposals.id],
}),
```

## Duplicate Prevention

When an invoice already exists for a proposal (matching `proposalId`), the "Create Invoice" action should:

1. Show a warning: "An invoice already exists for this proposal (INV-XXXX). Create another?"
2. Allow the admin to proceed if they choose (some proposals may need multiple invoices, e.g., phase-based billing)
3. Not block the action — just inform

## Activity Events

When an invoice is created from a proposal, the activity log captures the linkage:

```typescript
{
  verb: 'INVOICE_CREATED',
  summary: `Created invoice for {clientName} from proposal "{proposalTitle}"`,
  metadata: {
    source: 'proposal',
    proposalId: proposal.id,
    proposalTitle: proposal.title,
  },
}
```

## Implementation Checklist (Phase 7)

1. Add `proposalId` column + index to invoices table (migration)
2. Add relation to Drizzle schema and relations
3. Create `mapProposalToLineItems()` helper
4. Add "Create Invoice" action to proposals table row actions
5. Wire proposal data into the invoice sheet pre-fill
6. Add duplicate prevention warning
7. Update activity event to include proposal source metadata
8. Test: create invoice from proposal → verify pre-fill
9. Test: create invoice from proposal with existing invoice → warning shown
10. Test: proposal deleted → invoice retains data, loses proposal reference
