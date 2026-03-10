# 03: Stripe Integration

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)
> Phase: **2 — Stripe Integration**
> Dependencies: Phase 1 (invoices + line items tables must exist)

## Package Setup

Install the Stripe Node.js SDK:

```bash
npm install stripe
```

## Environment Variables

Add to `.env.local` (and production environment):

```env
STRIPE_SECRET_KEY=sk_test_...          # Stripe API secret key
STRIPE_WEBHOOK_SECRET=whsec_...        # Webhook endpoint signing secret
```

> **Note:** `STRIPE_PUBLISHABLE_KEY` is NOT required for v1. Stripe Checkout uses server-side session creation + redirect — no client-side Stripe.js needed. The publishable key would only be needed if we add Stripe Elements (embedded payment forms) in the future.

> **Important:** Use test keys during development. Switch to live keys only in production. The webhook secret is specific to the endpoint and must be configured in the Stripe Dashboard.

## Stripe Client

Create `lib/stripe/client.ts`:

```typescript
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
  // Uses the SDK's default API version (latest at install time)
})
```

Mark as server-only: `lib/stripe/index.ts` should re-export with a `'server-only'` import guard.

## Checkout Session Creation

### API Route: `POST /api/invoices/[id]/checkout`

File: `app/api/invoices/[id]/checkout/route.ts`

This endpoint creates a Stripe Checkout Session for an invoice and returns the session URL.

**Auth:** `requireUser()` + `assertAdmin()`

**Flow:**

1. Fetch invoice with line items by ID
2. Validate: status must be `SENT` or `VIEWED` (not DRAFT, PAID, or VOID)
3. Validate: `shareEnabled` must be true (invoice must be shared)
4. If a `stripeCheckoutSessionId` already exists and the session is still open, return the existing session URL (idempotent)
5. Create Stripe Checkout Session:
   - `mode: 'payment'` (one-time payment)
   - `line_items`: map invoice line items to Stripe line items
   - `success_url`: `/share/invoices/{token}?payment=success`
   - `cancel_url`: `/share/invoices/{token}?payment=cancelled`
   - `metadata`: `{ invoiceId: invoice.id }` (for webhook lookup)
   - `client_reference_id`: invoice ID
6. Store `stripeCheckoutSessionId` on the invoice
7. Return `{ ok: true, data: { url: session.url } }`

### Public Checkout Route: `POST /api/public/invoices/[token]/checkout`

For unauthenticated clients accessing the public invoice page, a separate endpoint creates the checkout session using the share token instead of the invoice ID.

**Auth:** None (public), but validates token and sharing state

**Flow:**

1. Look up invoice by `shareToken` where `shareEnabled = true` and `deletedAt IS NULL`
2. Same validation and session creation as the admin route
3. Return `{ ok: true, data: { url: session.url } }`

### Stripe Line Item Mapping

```typescript
function mapLineItemsToStripe(
  lineItems: InvoiceLineItem[]
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return lineItems
    .filter(item => !item.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(item => {
      const quantity = Number(item.quantity)

      // Stripe requires integer quantities. For fractional quantities
      // (e.g., 12.5 hours × $200/hr), send as quantity=1 with the
      // pre-computed total as unit_amount to preserve accuracy.
      if (quantity % 1 !== 0) {
        return {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(Number(item.amount) * 100),
            product_data: {
              name: `${item.description} (${item.quantity} units)`,
            },
          },
          quantity: 1,
        }
      }

      return {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(Number(item.unitPrice) * 100), // Stripe uses cents
          product_data: {
            name: item.description,
          },
        },
        quantity,
      }
    })
}
```

> **Note on quantity precision:** Stripe Checkout requires integer quantities. The function automatically handles fractional quantities (e.g., 2.5 hours) by collapsing to `quantity=1` with the pre-computed total as `unit_amount`, appending the actual quantity to the description for clarity.

## Webhook Handler

### Endpoint: `POST /api/integrations/stripe`

File: `app/api/integrations/stripe/route.ts`

**Auth:** Stripe webhook signature verification (not user auth)

**Flow:**

1. Read raw request body (must NOT parse JSON — Stripe needs the raw body for signature verification)
2. Verify webhook signature using `stripe.webhooks.constructEvent(body, sig, webhookSecret)`
3. Handle event types:
   - `checkout.session.completed` → process payment
   - `checkout.session.expired` → clear stale session ID
4. Return `200 OK` (Stripe retries on non-2xx)

### Processing `checkout.session.completed`

```typescript
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoiceId ?? session.client_reference_id
  if (!invoiceId) return // Not our invoice

  // Idempotency: check current state before mutating
  const invoice = await getInvoiceById(invoiceId)
  if (!invoice) return
  if (invoice.status === 'PAID') return // Already processed

  // Update invoice
  await updateInvoice(invoiceId, {
    status: 'PAID',
    stripePaymentIntentId: session.payment_intent as string,
    paidAt: new Date().toISOString(),
  })

  // Create hour blocks for qualifying line items (see 06-hour-block-automation.md)
  await createHourBlocksFromInvoice(invoiceId)

  // Log activity
  await logInvoicePaid(invoiceId, invoice)
}
```

### Processing `checkout.session.expired`

When a Stripe Checkout session expires (default 24 hours), we clear the session ID so the admin or client can create a new checkout session.

```typescript
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoiceId ?? session.client_reference_id
  if (!invoiceId) return

  const invoice = await getInvoiceById(invoiceId)
  if (!invoice) return
  if (invoice.status === 'PAID') return // Paid before expiry event arrived

  // Clear the stale session ID so a new one can be created
  await updateInvoice(invoiceId, {
    stripeCheckoutSessionId: null,
  })
}
```

**Why clear the session ID?** The checkout creation endpoint checks for an existing session ID and reuses it if still open. A stale expired session ID would cause the endpoint to try reusing a dead session. Clearing it allows a fresh session to be created on the next payment attempt.

**Seamless auto-recreate:** Stripe enforces a max session expiry of 24 hours. From the client's perspective, expired sessions are invisible — when they click "Pay Now" after a session has expired, the public checkout endpoint creates a fresh session and redirects them immediately. No error, no manual intervention needed.

### Other Stripe Events

| Event | Handling |
|-------|----------|
| `checkout.session.completed` | Process payment (see above) |
| `checkout.session.expired` | Clear stale session ID (see above) |
| `payment_intent.payment_failed` | **Ignored** — Stripe Checkout handles retry UI on-page. If the customer leaves, it's effectively an expiry. |
| All other events | Return 200, ignore silently |

We do NOT need stored DECLINED/ERROR invoice statuses. Stripe Checkout handles payment retries natively on the hosted page (customer can try a different card). From our perspective, either they pay (→ PAID) or they don't (stays SENT/VIEWED).

### Archived Invoice Handling

The `stripe_checkout_session_id` index intentionally omits a `deleted_at IS NULL` filter so that webhooks can find invoices even if they were archived mid-checkout. The handler should:

1. Look up the invoice by session ID (ignoring `deleted_at`)
2. If the invoice is soft-deleted (`deletedAt IS NOT NULL`): still process the payment (mark as PAID, create hour blocks), but log a warning. The admin archived it while a client was mid-payment — the payment is real and should be recorded.
3. Do NOT unarchive the invoice as a side effect — the admin made a conscious decision to archive it.

This ensures money is never silently lost, even if an admin archives an invoice they thought wouldn't be paid.

### Idempotency

Stripe can deliver webhook events multiple times. The handler must be idempotent:

1. **Check current state** before mutating — if already `PAID`, return early
2. **Hour block creation** uses `INSERT ... ON CONFLICT (invoice_line_item_id) DO NOTHING` via the unique partial index on `hour_blocks`, preventing duplicates even under concurrent webhook deliveries
3. **Activity logging** is fire-and-forget and duplicates are acceptable (they show the same event twice in the feed, not harmful)

### Webhook Security

- **Signature verification** is mandatory. Never process unverified webhooks.
- **Raw body parsing** — Next.js App Router provides the raw body via `request.text()`. Do NOT use `request.json()` before verification.
- **Timing attacks** — Stripe's `constructEvent` uses timing-safe comparison internally.

### Local Development

Use Stripe CLI to forward webhooks to localhost:

```bash
stripe listen --forward-to localhost:3000/api/integrations/stripe
```

The CLI provides a webhook signing secret (`whsec_...`) for local testing.

## Error Handling

### Checkout Creation Errors

| Error | Response | Action |
|-------|----------|--------|
| Invoice not found | 404 | Return error |
| Invalid status (DRAFT/PAID/VOID) | 400 | Return error with status explanation |
| Sharing not enabled | 400 | Return error |
| Stripe API error | 500 | Log error, return generic message |

### Webhook Errors

| Error | Response | Action |
|-------|----------|--------|
| Invalid signature | 400 | Return error, do not process |
| Unknown event type | 200 | Ignore silently (Stripe sends many event types) |
| Invoice not found | 200 | Log warning, return 200 (don't trigger retries for missing data) |
| DB error during processing | 500 | Return 500 (Stripe will retry) |

## Webhook Reliability

**v1: Inline processing, no queue.** The webhook handler processes events synchronously within the request. This is acceptable because:

1. **Stripe retries automatically** — non-2xx responses trigger exponential backoff retries for up to 3 days
2. **Processing is fast** — one UPDATE + a few INSERTs is ~50ms of DB operations
3. **Idempotency guards** prevent duplicate processing from retries
4. **No heavy side effects** — v1 has no PDF generation, no email sends on payment (notifications deferred)

**Future: Queue if needed.** If webhook processing becomes heavier (PDF generation, email delivery, multi-step workflows), consider:
- `waitUntil()` from Vercel for fire-and-forget background work
- Inngest or Trigger.dev for reliable, retryable background jobs
- A dead-letter pattern for failed processing

## Implementation Checklist (Phase 2)

1. Install `stripe` package: `npm install stripe`
2. Add env vars to `.env.local` and deployment environment
3. Create `lib/stripe/client.ts` with Stripe instance
4. Create `POST /api/invoices/[id]/checkout` route
5. Create `POST /api/public/invoices/[token]/checkout` route
6. Create `POST /api/integrations/stripe` webhook route
7. Implement `handleCheckoutCompleted` with idempotency guards
8. Implement `handleCheckoutExpired` to clear stale session IDs
9. Configure webhook endpoint in Stripe Dashboard (subscribe to `checkout.session.completed` and `checkout.session.expired`)
10. Test with Stripe CLI locally
