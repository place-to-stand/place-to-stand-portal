# 04: Sharing & Public Invoice Page

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)
> Phase: **4 — Sharing & Public Page**
> Dependencies: Phase 1 (data model), Phase 2 (Stripe checkout)

## Share / Unshare Flow

Follows the proposals pattern exactly. Admin-only operations.

### API Route: `POST /api/invoices/[id]/share`

File: `app/api/invoices/[id]/share/route.ts`

**Auth:** `requireUser()` + `assertAdmin()`

**Flow:**

Note: The "Send" action is coupled with sharing — sending an invoice automatically enables sharing. This route also supports re-enabling sharing after it was disabled.

1. Fetch invoice by ID
2. Validate: status must be `SENT`, `VIEWED`, or `PAID` (sharing a DRAFT or VOID invoice is not allowed — DRAFT invoices must be sent first via the send action, which enables sharing automatically)
3. Reuse existing `shareToken` if present (idempotent), otherwise generate: `crypto.randomUUID().replace(/-/g, '')`
4. Set `shareEnabled = true`
5. Log `INVOICE_SHARED` activity event
6. Return `{ ok: true, data: { shareToken } }`

### API Route: `POST /api/invoices/[id]/unshare`

File: `app/api/invoices/[id]/unshare/route.ts`

**Auth:** `requireUser()` + `assertAdmin()`

**Flow:**

1. Set `shareEnabled = false` (preserve the token for re-enabling)
2. Log `INVOICE_UNSHARED` activity event
3. Return `{ ok: true }`

### Share Dialog UI

File: `app/(dashboard)/invoices/_components/share-invoice-dialog.tsx`

Reuses the same UI pattern as `ShareProposalDialog`:

- **When sharing is enabled:** Show URL with copy button, view count, disable button
- **When sharing is disabled:** Show enable button
- **No password protection** in v1 (unlike proposals)

The share URL format: `${origin}/share/invoices/${shareToken}`

### Quick Copy

In the invoice list table, each row has a "Copy Link" action button that:
1. If sharing is already enabled: copies the URL to clipboard immediately
2. If sharing is not enabled: opens the share dialog

This provides the "quick copy" workflow requested.

## Public Invoice Page

### Route: `app/(public)/share/invoices/[token]/page.tsx`

Uses the existing `app/(public)/layout.tsx` — same branded header, centered content, no auth.

**Server Component Flow:**

1. Look up invoice by `shareToken` where `shareEnabled = true` and `deletedAt IS NULL`
2. If not found → `notFound()` (404)
3. Fetch line items for the invoice
4. Fetch client name for display
5. Check `getSession()` — if authenticated admin, skip view tracking
6. Otherwise, call `recordInvoiceView(invoice.id)` (fire-and-forget)
7. Render `<PublicInvoice>` component

**Metadata:**
```typescript
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Invoice ${invoice.invoiceNumber ?? 'Draft'} | Place to Stand`,
    robots: { index: false, follow: false },
  }
}
```

### View Tracking

File: `lib/queries/invoices.ts`

```typescript
export async function recordInvoiceView(invoiceId: string) {
  // Atomic increment — no SELECT+UPDATE race condition
  const [result] = await db
    .update(invoices)
    .set({
      viewedAt: sql`NOW()`,
      viewedCount: sql`COALESCE(viewed_count, 0) + 1`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(invoices.id, invoiceId))
    .returning({ previousCount: sql<number>`viewed_count - 1` })

  // Transition SENT → VIEWED on first view
  if (result.previousCount === 0) {
    await db
      .update(invoices)
      .set({ status: 'VIEWED', updatedAt: sql`NOW()` })
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.status, sql`'SENT'`)
        )
      )
  }

  return result.previousCount
}
```

Mirrors the proposals `recordProposalView` pattern exactly.

### Data Layer: `viewSharedInvoice()`

File: `lib/data/invoices.ts`

```typescript
export async function viewSharedInvoice(invoiceId: string) {
  const previousCount = await recordInvoiceView(invoiceId)

  if (previousCount === 0) {
    // First view — log activity
    logInvoiceViewed(invoiceId).catch(console.error)
  }
}
```

## Public Invoice UI Component

File: `app/(public)/share/invoices/[token]/public-invoice.tsx`

A client component that renders a **traditional invoice document layout** — formal, printable, resembling a standard business invoice.

### Document Header
- Place to Stand branding / logo (top left)
- "INVOICE" title (top right)
- Invoice number (e.g., `INV-0042`)
- Issue date and due date

### Bill To Section
- Client name
- (Future: client billing address, contact info)

### Line Items Table

A formal itemized table:

| # | Description | Qty | Unit Price | Amount |
|---|-------------|-----|------------|--------|
| 1 | Development Hours | 10 | $200.00 | $2,000.00 |
| 2 | Server Hosting (March) | 1 | $45.00 | $45.00 |

### Totals Section
- Subtotal
- Tax rate (e.g., "Tax (8.75%)")
- Tax amount
- **Total** (bold, larger, prominent)

### Notes Section
- Optional notes from the invoice (displayed below totals if present)

### Payment Section
- **Status: SENT or VIEWED** → prominent "Pay Now" button → redirects to Stripe Checkout
- **Status: PAID** → green "Paid" badge with payment date, no pay button
- **Status: VOID** → "This invoice has been voided" message, muted styling, no pay button

**Void behavior:** Voiding an invoice does NOT disable sharing. The public page still loads and renders the full invoice, but with a clear "Voided" indicator and no payment button. This allows clients who bookmarked the link to still see the invoice history.

### Pay Now Flow

1. Client clicks "Pay Now"
2. Frontend calls `POST /api/public/invoices/{token}/checkout`
3. API creates Stripe Checkout Session, returns `{ url }`
4. Frontend redirects to `session.url` (Stripe hosted page)
5. After payment:
   - **Success:** Stripe redirects to `/share/invoices/{token}?payment=success`
   - **Cancel:** Stripe redirects to `/share/invoices/{token}?payment=cancelled`
6. Success page shows confirmation message
7. Stripe webhook fires `checkout.session.completed` → invoice marked PAID

### Payment Status Messages

On the public page, check URL params for post-payment messaging:

```typescript
if (searchParams.payment === 'success') {
  // Show success banner: "Payment received! Thank you."
  // Note: invoice status may not be PAID yet (webhook is async)
  // Show optimistic message, page refresh will show final state
}

if (searchParams.payment === 'cancelled') {
  // Show info banner: "Payment was cancelled. You can try again below."
}
```

## Email Delivery on Send

When an invoice is sent (DRAFT→SENT), an email is delivered to the client's primary contact. See [08-email-and-pdf.md](./08-email-and-pdf.md) for the full spec. The email includes:

- Invoice number and total amount
- PDF attachment of the invoice
- "View & Pay" button linking to the public invoice page
- Sent via Resend (same provider as other client-facing emails)

The share link is generated as part of the send action, so the email contains a working payment link.

## Admin Invoice Link

From the dashboard invoice list, each invoice row shows a "View Public Invoice" link (external link icon) that opens the public URL in a new tab. This is only available when `shareEnabled = true`.

## Implementation Checklist (Phase 4)

1. Create `POST /api/invoices/[id]/share` route
2. Create `POST /api/invoices/[id]/unshare` route
3. Create `ShareInvoiceDialog` component
4. Add `recordInvoiceView()` to `lib/queries/invoices.ts`
5. Add `viewSharedInvoice()` to `lib/data/invoices.ts`
6. Create `app/(public)/share/invoices/[token]/page.tsx`
7. Create `PublicInvoice` client component
8. Create `POST /api/public/invoices/[token]/checkout` route
9. Handle `?payment=success` and `?payment=cancelled` query params
10. Wire "Copy Link" quick action in invoice table rows
