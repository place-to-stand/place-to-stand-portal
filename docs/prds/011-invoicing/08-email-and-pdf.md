# 08: Email Delivery & PDF Generation

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)
> Phase: **6 — Email & PDF**
> Dependencies: Phase 1 (data model), Phase 3 (dashboard UI), Phase 4 (sharing/public page)

## Overview

When an admin sends an invoice (DRAFT→SENT), the system delivers an email to the client's primary contact with a PDF attachment and a link to view and pay online. This follows the agency's professional billing workflow: the client receives a polished email, can review the PDF offline, and click through to pay via Stripe.

## PDF Generation

### Approach

Use `@react-pdf/renderer` — the same library used for executed proposals. This keeps the rendering pipeline consistent across the portal.

File: `lib/invoices/invoice-pdf.tsx`

### PDF Layout

The PDF mirrors the public invoice page layout (see [04-sharing-and-public-page.md](./04-sharing-and-public-page.md)):

1. **Header** — Place to Stand logo/name, "INVOICE" title
2. **Invoice details** — Invoice number, issue date, due date
3. **Bill To** — Client name (future: billing address)
4. **Line items table** — Description, quantity, unit price, amount
5. **Totals** — Subtotal, tax (with rate label), total
6. **Notes** — Optional notes section
7. **Footer** — "View and pay online: {shareUrl}"

### Generation Trigger

PDF is generated on-demand during the send action, not stored. This keeps storage simple and ensures the PDF always reflects the current invoice state.

```typescript
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePdf } from '@/lib/invoices/invoice-pdf'

async function generateInvoicePdf(invoice: InvoiceWithLineItems): Promise<Buffer> {
  return renderToBuffer(<InvoicePdf invoice={invoice} />)
}
```

### Future: Stored PDFs

If PDFs need to be downloaded later (from the dashboard or public page), store them in Supabase Storage (`invoices` bucket). This is deferred — v1 generates on-the-fly for the email attachment only.

## Email Delivery

### Provider

Resend — the portal's existing email provider for client-facing communication.

### Template

File: `lib/email/invoice-sent.tsx` (React Email template)

**Subject:** `Invoice ${invoiceNumber} from Place to Stand — ${formattedTotal}`

**Body:**

```
Hi {clientName},

Please find attached invoice {invoiceNumber} for {formattedTotal}.

Due date: {formattedDueDate || "Upon receipt"}

[View & Pay Online →]({shareUrl})

Thank you,
Place to Stand
```

**Attachments:**
- `{invoiceNumber}.pdf` — the generated invoice PDF

### Recipient

The email is sent to the client's primary contact email. The contact is determined by:

1. The client record's associated contacts (via `client_members` + `users` table)
2. If multiple contacts exist, send to all of them (they all have access to the client)
3. If no contacts exist, skip email delivery and log a warning

### Send Flow

Integrated into the `sendInvoice` action:

```typescript
async function sendInvoice(user: User, invoiceId: string) {
  // 1. Transition DRAFT→SENT (assign number, enable sharing)
  const invoice = await transitionToSent(invoiceId)

  // 2. Generate PDF
  const pdfBuffer = await generateInvoicePdf(invoice)

  // 3. Get client contacts
  const contacts = await getClientContacts(invoice.clientId)

  // 4. Send email (fire-and-forget, don't block the action)
  if (contacts.length > 0) {
    sendInvoiceEmail({
      to: contacts.map(c => c.email),
      invoice,
      pdfBuffer,
      shareUrl: `${getBaseUrl()}/share/invoices/${invoice.shareToken}`,
    }).catch(error => {
      console.error('Failed to send invoice email:', error)
      // Log activity warning — invoice is still sent even if email fails
    })
  }

  // 5. Log activity
  await logInvoiceSent(invoiceId, invoice)
}
```

**Important:** Email delivery is fire-and-forget. The send action succeeds even if the email fails to deliver. The invoice is still marked as SENT and shareable. Email failure is logged but doesn't block the workflow.

### Resend Integration

```typescript
import { getResendClient } from '@/lib/email/resend'
import { serverEnv } from '@/lib/env.server'

const resend = getResendClient()

async function sendInvoiceEmail(params: {
  to: string[]
  invoice: InvoiceWithLineItems
  pdfBuffer: Buffer
  shareUrl: string
}) {
  await resend.emails.send({
    from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
    to: params.to,
    subject: `Invoice ${params.invoice.invoiceNumber} from Place to Stand — ${formatCurrency(params.invoice.total)}`,
    react: InvoiceSentEmail({ invoice: params.invoice, shareUrl: params.shareUrl }),
    attachments: [
      {
        filename: `${params.invoice.invoiceNumber}.pdf`,
        content: params.pdfBuffer,
      },
    ],
  })
}
```

> **Note:** Uses the same `RESEND_FROM_EMAIL` env var as other portal emails (currently `portal@notifications.placetostandagency.com`). No additional domain verification needed. The subject line distinguishes invoice emails from other portal notifications.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| PDF generation fails | Log error, send email without attachment (include link only) |
| Email delivery fails | Log error, invoice still marked SENT. Admin can re-share manually. |
| No client contacts | Log warning, skip email. Invoice is still sent and shareable via link. |
| Resend rate limit | Fire-and-forget — Resend queues internally. If truly rejected, logged. |

## Implementation Checklist (Phase 6)

1. Create `lib/invoices/invoice-pdf.tsx` — React PDF template
2. Create `lib/email/invoice-sent.tsx` — React Email template
3. Add `sendInvoiceEmail()` to `lib/email/` (or `lib/invoices/`)
4. Integrate PDF generation + email into `sendInvoice` action
5. Add `getClientContacts()` query if not already available
6. Test: send invoice → email received with PDF attachment
7. Test: send invoice with no client contacts → no email, no error
8. Test: PDF renders correctly with line items, tax, totals
9. Verify Resend `from` domain is configured
