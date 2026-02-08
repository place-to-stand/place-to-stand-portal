# 03: Stripe & Payments

> Part of [PRD 009: Invoices & Scopes of Work](./README.md)
> Related: [02-invoice-system.md](./02-invoice-system.md) | [08-integration-architecture.md](./08-integration-architecture.md)

## Public Invoice Page

Invoices have a share link (like proposals) that opens a fully branded, public-facing invoice page showing:

- Company logo, name, and address.
- Client name and contact info.
- Invoice number, date, due date, payment terms.
- Line items table with descriptions, quantities, rates, and amounts.
- Subtotal, tax (if applicable), and total.
- **Embedded Stripe Elements** payment form for card or ACH payment.

## Payment Flow

1. Admin creates invoice in portal (`DRAFT` status).
2. Admin enables sharing (generates `share_token`), sends link to client via email (Resend).
3. Status moves to `SENT`. Client opens page → `VIEWED`.
4. Client fills in Stripe Elements payment form and submits.
5. Portal creates a Stripe PaymentIntent for the invoice total.
6. On successful payment, Stripe webhook (`payment_intent.succeeded`) fires to `POST /api/integrations/stripe/webhook`.
7. Portal calls the shared `markInvoicePaid()` function.

## Stripe Integration Layer

```
lib/integrations/stripe/
  client.ts            — Stripe SDK initialization (lazy singleton, STRIPE_SECRET_KEY)
  payment-intents.ts   — createPaymentIntent(), getPaymentIntent()
  webhooks.ts          — handleWebhookEvent(), verifySignature()
```

**Naming note:** Gmail integration lives at `lib/gmail/`, not `lib/integrations/gmail/`. Stripe is placed under `lib/integrations/stripe/` to establish the pattern for future integrations. Consider migrating `lib/gmail/` later for consistency (out of scope).

## `markInvoicePaid()` — Shared Idempotent Handler

Location: `lib/data/invoices/mark-paid.ts`

Both the webhook handler and the polling fallback call this same function:

1. Look up invoice by `stripe_payment_intent_id`.
2. **Idempotency check:** If invoice is already `PAID`, return early (200 OK). Prevents duplicate hour block creation.
3. **Transaction:**
   - Update invoice: `status = PAID`, `paid_at = now()`, `payment_method = 'stripe_card'` (or `'stripe_ach'`).
   - If prepaid: For **each** `HOURS_PREPAID` line item, create a separate `hour_block` record with that line item's `quantity` as hours. Update each line item's `hour_block_id`. (Multiple HOURS_PREPAID items = multiple hour blocks.)
4. Commit transaction.
5. Log activity event (fire-and-forget, outside transaction).

## Webhook Endpoint

`POST /api/integrations/stripe/webhook`

**Handler pattern:**
```
1. Verify Stripe signature (STRIPE_WEBHOOK_SECRET)
2. Extract payment_intent_id from event
3. Look up invoice by stripe_payment_intent_id
4. If invoice not found, return 200 (Stripe recommends acknowledging unknown events)
5. Call markInvoicePaid() — idempotent, handles already-paid case
6. Return 200
```

**Events to handle:**

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Call `markInvoicePaid()`. Creates hour block if prepaid. Logs activity. |
| `payment_intent.payment_failed` | Log failure. No status change (client can retry). |
| `charge.refunded` | Mark invoice `REFUNDED`. Log activity. |

**Event ordering note:** Stripe does not guarantee delivery order. The handler uses `payment_intent.succeeded` as the authoritative signal and does not depend on receiving `payment_intent.created` first.

## Polling Fallback

Manual "Check Payment Status" button on invoice detail page:
- Queries Stripe's PaymentIntent API directly.
- Calls the same `markInvoicePaid()` function.
- Idempotent — safe to call multiple times.

## Environment Variables

| Variable | Purpose | Client/Server |
|----------|---------|---------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key | Server only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for Elements | Client (needs `NEXT_PUBLIC_` prefix) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Server only |
