# 05: Dashboard UI

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)
> Phase: **3 — Dashboard UI**
> Dependencies: Phase 1 (data model, queries)

## Navigation

Add "Invoices" to the Sales group in `components/layout/navigation-config.ts`:

```typescript
import { Receipt } from 'lucide-react'

// In the Sales group, between Proposals and Hour Blocks:
{
  href: '/invoices',
  label: 'Invoices',
  icon: Receipt,
  matchHrefs: ['/invoices'],
}
```

**Position:** After Proposals, before Hour Blocks. The natural Sales flow becomes: Leads → Proposals → Invoices → Hour Blocks.

**Visibility (v1):** `roles: ['ADMIN']` — admin-only. Clients access invoices via the public share link only. Client dashboard visibility is deferred (see [07-future-enhancements.md](./07-future-enhancements.md)).

## File Structure

```
app/(dashboard)/invoices/
├── page.tsx                          — active invoice list (RSC)
├── archive/page.tsx                  — archived invoices (RSC)
├── activity/page.tsx                 — activity feed (RSC)
├── invoice-sheet.tsx                 — slide-out form (client)
├── _components/
│   ├── invoices-management-table.tsx — client orchestrator
│   ├── invoices-table-section.tsx    — pure table render
│   ├── invoices-activity-section.tsx — wraps ActivityFeed
│   ├── invoices-tabs-nav.tsx         — tabs navigation
│   ├── invoices-add-button.tsx       — header CTA
│   ├── invoice-archive-dialog.tsx    — archive confirmation
│   └── share-invoice-dialog.tsx      — share/unshare dialog
└── actions/
    ├── index.ts                      — barrel export
    ├── save-invoice.ts               — create/update server action
    ├── archive-invoice.ts            — soft delete
    ├── restore-invoice.ts            — unarchive
    ├── destroy-invoice.ts            — hard delete (from archive only)
    ├── send-invoice.ts               — DRAFT→SENT transition
    ├── void-invoice.ts               — mark as void
    ├── schemas.ts                    — Zod validation schemas
    ├── types.ts                      — inferred types + ActionResult
    └── helpers.ts                    — INVOICES_PATH constant
```

```
lib/invoices/
├── invoice-form.ts                   — form types, Zod schema, defaults, payload builder
├── invoice-options.ts                — buildClientOptions(), buildProductCatalogOptions()
├── invoice-ui-state.ts              — derive*State() pure functions
├── use-invoice-sheet-state.ts       — full sheet logic hook
└── use-invoices-table-state.ts      — table row actions
```

## List Page

File: `app/(dashboard)/invoices/page.tsx`

Follows the hour blocks pattern:

```typescript
export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const currentUser = await requireRole('ADMIN')
  // ... pagination parsing ...

  const { items, clients, totalCount } = await listInvoices(currentUser, {
    status: 'active',
    offset,
    limit: PAGE_SIZE,
  })

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Invoices</h1>
          <p className='text-muted-foreground text-sm'>
            Create, share, and track payment for client invoices.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <InvoicesTabsNav activeTab='invoices' />
          <div className='flex items-center gap-6'>
            <span className='text-muted-foreground text-sm'>
              Total invoices: {totalCount}
            </span>
            <InvoicesAddButton clients={clients} />
          </div>
        </div>
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <InvoicesManagementTable
            invoices={items}
            clients={clients}
            totalCount={totalCount}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            mode='active'
          />
        </section>
      </div>
    </>
  )
}
```

## Table Columns

The invoice table displays:

| Column | Content |
|--------|---------|
| Invoice # | `INV-0001` or "Draft" badge |
| Client | Client name |
| Status | Badge: Draft (gray), Sent (blue), Viewed (yellow), Paid (green), Void (red) |
| Total | Formatted currency |
| Due Date | Date with overdue indicator if past due |
| Issued | Date or "—" for drafts |
| Actions | Edit, Share/Copy Link, View Public, Archive/Restore/Destroy |

### Status Badges

```typescript
const STATUS_BADGE_MAP = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  SENT: { label: 'Sent', variant: 'default' },
  VIEWED: { label: 'Viewed', variant: 'warning' },
  PAID: { label: 'Paid', variant: 'success' },
  VOID: { label: 'Void', variant: 'destructive' },
} as const
```

### Overdue Indicator

For invoices where `dueDate < today` and status is `SENT` or `VIEWED`:
- Show a red "Overdue" badge next to the status
- This is computed at render time, not stored

### Row Actions (Active Mode)

| Action | Icon | Condition |
|--------|------|-----------|
| Edit | Pencil | Status is DRAFT or SENT (locked at VIEWED) |
| Send | Send | Status is DRAFT (assigns number + enables sharing) |
| Copy Link | Copy | shareEnabled is true (available after send) |
| View Public | ExternalLink | shareEnabled is true |
| Disable Sharing | Link2Off | shareEnabled is true (toggle off without voiding) |
| Re-enable Sharing | Link2 | shareEnabled is false AND status is SENT/VIEWED/PAID |
| Void | Ban | Status is DRAFT, SENT, or VIEWED |
| Archive | Archive | Any status |

### Row Actions (Archive Mode)

| Action | Icon | Condition |
|--------|------|-----------|
| Restore | RefreshCw | Always |
| Destroy | Trash2 | Always (with confirmation) |

## Invoice Sheet (Slide-Out Form)

File: `app/(dashboard)/invoices/invoice-sheet.tsx`

The sheet form handles both create and edit modes. It follows the hour blocks sheet pattern with `useSheetFormControls` for undo/redo and keyboard shortcuts.

### Form Fields

**Header Section:**
- Client (combobox, required) — selecting a client auto-sets the due date default based on billing type
- Due Date (date picker, optional) — defaults based on client billing type: `net_30` → 30 days from today, `prepaid` → blank (upon receipt). Admin can always override.
- Notes (textarea, optional)

**Line Items Section:**
- Dynamic array of line items, each with:
  - Product (combobox selecting from product catalog, optional)
  - Description (text, required — auto-filled from product catalog selection)
  - Quantity (number input, required)
  - Unit Price (currency input, required — auto-filled from product catalog)
  - Amount (computed, read-only: quantity × unit price)
  - Creates Hour Block (checkbox — auto-set based on product catalog item)
  - Remove button (trash icon)
- "Add Line Item" button at bottom

**Tax Section** (below line items):
- Tax Rate (percentage input, e.g., "8.75" for 8.75%, defaults to 0)
- Tax Amount (computed, read-only: subtotal × tax rate)

**Totals Section:**
- Subtotal (sum of line item amounts)
- Tax (tax amount with rate label)
- **Total** (subtotal + tax, bold)

**Selecting a product catalog item** auto-fills description, unit price, unit label, and the `createsHourBlock` flag. The admin can override any of these values.

**Minimum hours warning:** If a "Development Hours" line item (or any line item with `createsHourBlock = true`) has a quantity less than 5, show a yellow warning: "Minimum billable block is 5 hours." The warning is advisory — it does not block saving.

### Form Behavior

- **Create mode:** `invoice = null`, form starts with one empty line item
- **Edit mode:** `invoice = <record>`, form populated from existing data
- **Editable through SENT:** DRAFT and SENT invoices are fully editable. Editing a SENT invoice clears any existing `stripeCheckoutSessionId` (invalidating an in-progress checkout), recalculates totals, and logs an `INVOICE_UPDATED` event. The invoice number and share token are preserved.
- **Locked at VIEWED:** Once a client has viewed the invoice, it is immutable. The sheet opens in **read-only view mode** for VIEWED, PAID, and VOID invoices. To make changes, void the invoice and create a new one.
- **Save:** Server action creates/updates the invoice and its line items in a single transaction
- **Line item management:** Uses React Hook Form's `useFieldArray` for dynamic line items

### Fixed Footer Bar

Same pattern as hour blocks:
- Left: Undo / Redo buttons (basic form-level undo via `useSheetFormControls`)
- Right: Save button (or "Send Invoice" for draft→sent shortcut)
- Position: fixed, blur backdrop

## Tabs Navigation

File: `app/(dashboard)/invoices/_components/invoices-tabs-nav.tsx`

```typescript
const INVOICES_TABS = [
  { label: 'Invoices', value: 'invoices', href: '/invoices' },
  { label: 'Archive', value: 'archive', href: '/invoices/archive' },
  { label: 'Activity', value: 'activity', href: '/invoices/activity' },
]
```

Same component pattern as `HourBlocksTabsNav`.

## Archive Page

File: `app/(dashboard)/invoices/archive/page.tsx`

Identical pattern to hour blocks archive:
- Same `listInvoices(user, { status: 'archived' })` query
- Same table component with `mode='archive'`
- Restore and Destroy actions
- Two-step destruction: archive first, then destroy from archive page

## Activity Page

File: `app/(dashboard)/invoices/activity/page.tsx`

Identical pattern to hour blocks activity:

```typescript
<InvoicesActivitySection />
// which renders:
<ActivityFeed targetType='INVOICE' requireContext={false} />
```

## Queries Layer

File: `lib/queries/invoices.ts`

### `listInvoices(user, input)`

- Admin-only (`assertAdmin`)
- Joins `invoices` → `clients` for client name display
- Supports `status: 'active' | 'archived'` filtering
- Supports pagination (offset + limit)
- Returns `{ items, clients, totalCount }`
- Also returns the product catalog items list for the sheet form

### `getInvoiceById(user, id)`

- Fetches invoice with all line items, joined to product catalog
- Used for sheet edit and activity diff logging

### `getInvoiceByShareToken(token)`

- Public query (no auth check — token IS the auth)
- Filters: `shareToken = token`, `shareEnabled = true`, `deletedAt IS NULL`
- Returns invoice with line items and client name

### `saveInvoice(user, payload)`

- Upsert: create if no `id`, update if `id` provided
- Validates status is DRAFT or SENT (cannot edit VIEWED/PAID/VOID invoices)
- For SENT invoices: clears `stripeCheckoutSessionId` on edit (invalidates any in-progress checkout)
- Handles line items: delete removed items, upsert existing/new items
- Recompute totals after line item changes
- Wrapped in a transaction

### `sendInvoice(user, id)`

- DRAFT→SENT transition
- Assigns invoice number from SEQUENCE
- Sets `issuedDate` to today
- Returns the assigned invoice number

### `listProductCatalogItems()`

- Returns all active, non-deleted catalog items ordered by `sortOrder`
- Used for the line item product selector in the sheet form

## Server Actions

### `saveInvoiceAction(formData)`

File: `app/(dashboard)/invoices/actions/save-invoice.ts`

```typescript
'use server'

export async function saveInvoiceAction(
  input: SaveInvoiceInput
): Promise<ActionResult> {
  const user = await requireRole('ADMIN')
  // Validate with Zod
  // Call saveInvoice(user, payload)
  // Log activity (create or update)
  // revalidatePath('/invoices')
}
```

### `sendInvoiceAction(invoiceId)`

File: `app/(dashboard)/invoices/actions/send-invoice.ts`

Calls `sendInvoice()` which:
1. Assigns the invoice number from the PostgreSQL SEQUENCE
2. Sets `issuedDate` to today
3. Transitions status to `SENT`
4. Generates a share token and enables sharing (`shareEnabled = true`)

**Send and share are coupled.** There is no way to finalize an invoice without making it shareable. This simplifies the flow: "Send" = "ready for the client to see and pay."

### `archiveInvoiceAction(invoiceId)`

Sets `deletedAt` on the invoice. Does NOT archive line items separately.

### `restoreInvoiceAction(invoiceId)`

Clears `deletedAt`.

### `destroyInvoiceAction(invoiceId)`

Hard deletes the invoice. Line items cascade. Only from archive page. Catches FK constraint errors (e.g., hour blocks referencing this invoice — those have SET NULL, so this should succeed).

### `voidInvoiceAction(invoiceId)`

Sets `status = 'VOID'`. Only valid for DRAFT, SENT, or VIEWED invoices.

## Activity Events

File: `lib/activity/events/invoices.ts`

| Verb | Summary | When |
|------|---------|------|
| `INVOICE_CREATED` | "Created invoice for {client}" | Save action (create) |
| `INVOICE_UPDATED` | "Updated invoice {number}" | Save action (update) |
| `INVOICE_SENT` | "Sent invoice {number}" | Send action |
| `INVOICE_VIEWED` | "Invoice {number} was viewed" | First public page view |
| `INVOICE_PAID` | "Invoice {number} was paid" | Stripe webhook |
| `INVOICE_VOIDED` | "Voided invoice {number}" | Void action |
| `INVOICE_SHARED` | "Shared invoice {number}" | Share API |
| `INVOICE_UNSHARED` | "Disabled sharing for invoice {number}" | Unshare API |
| `INVOICE_ARCHIVED` | "Archived invoice {number}" | Archive action |
| `INVOICE_RESTORED` | "Restored invoice {number}" | Restore action |

All events set `targetType: 'INVOICE'`, `targetId: invoiceId`, `targetClientId: clientId`.

## Proposal-to-Invoice Integration

The "Create Invoice from Proposal" action is available on accepted/signed proposals. See [09-proposal-to-invoice.md](./09-proposal-to-invoice.md) for the full spec. In the dashboard UI, this manifests as:

- A "Create Invoice" action in the proposals table row actions (when proposal is signed/accepted and has a client)
- Pre-fills the invoice sheet with client, line items, and notes derived from the proposal
- The created invoice links back to the proposal for traceability

## Implementation Checklist (Phase 3)

1. Create `lib/queries/invoices.ts` with all query functions
2. Create `lib/queries/product-catalog.ts` with catalog queries
3. Create `lib/invoices/invoice-form.ts` (form types, Zod schema, defaults)
4. Create `lib/invoices/invoice-options.ts` (client and catalog option builders)
5. Create `lib/invoices/invoice-ui-state.ts` (state derivation)
6. Create `lib/invoices/use-invoice-sheet-state.ts` (sheet logic hook)
7. Create `lib/invoices/use-invoices-table-state.ts` (table actions hook)
8. Create all server actions in `app/(dashboard)/invoices/actions/`
9. Create `InvoicesTabsNav` component
10. Create `InvoicesAddButton` component
11. Create `InvoicesTableSection` component
12. Create `InvoicesManagementTable` component
13. Create `InvoiceSheet` component with line items form
14. Create `InvoiceArchiveDialog` component
15. Create `InvoicesActivitySection` component
16. Create list page `app/(dashboard)/invoices/page.tsx`
17. Create archive page `app/(dashboard)/invoices/archive/page.tsx`
18. Create activity page `app/(dashboard)/invoices/activity/page.tsx`
19. Add activity events in `lib/activity/events/invoices.ts`
20. Register `INVOICE` target type and verbs in `lib/activity/types.ts`
21. Export from `lib/activity/events.ts`
22. Add nav entry to `components/layout/navigation-config.ts`
