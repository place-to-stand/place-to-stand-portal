# 08: Integration Architecture

> Part of [PRD 009: Invoices & Scopes of Work](./README.md)
> Related: [03-stripe-and-payments.md](./03-stripe-and-payments.md) | [04-monthly-billing-cron.md](./04-monthly-billing-cron.md)

## Shared Sharing Infrastructure

The share token pattern (token generation, validation, public page routing) is used by proposals, invoices, and SOWs. Extract into a shared module:

```
lib/sharing/
  tokens.ts          — generateShareToken() (32-char hex), TOKEN_REGEX (/^[a-f0-9]{32,64}$/),
                       validateToken(). Note: proposals also use generateCountersignToken()
                       (64-char hex via randomBytes) — regex must accommodate both lengths.
  password.ts        — hashSharePassword(), verifySharePassword() (wrapping bcryptjs)
  view-tracking.ts   — recordView() generic helper for tracking first-view timestamps
  types.ts           — ShareableEntity interface
```

**Extraction source:** Existing implementation in `lib/data/proposals.ts` (`generateShareToken()`, `generateCountersignToken()`, bcryptjs password hashing). **Note:** `lib/auth/crypto.ts` contains HMAC signing/verification only (not password hashing). The bcryptjs-based functions should be extracted from proposals into `lib/sharing/password.ts`.

## Public Routes

All public-facing pages live under `app/(public)/`, reusing the branded layout (logo header, centered content). `noindex`/`nofollow` meta set per-page via Next.js `metadata` export (not layout):

```
app/(public)/
  layout.tsx                    — Existing branded layout
  p/[token]/                    — Existing proposal public pages
  invoice/[shareToken]/         — NEW: Public invoice page
  │  ├── Renders: company branding, line items, totals
  │  ├── Tracks: viewed_at on first visit
  │  ├── Embeds: Stripe Elements payment form
  │  └── On payment: creates PaymentIntent
  sow/[shareToken]/             — NEW: Public SOW page
     ├── Renders: SOW content (phases, deliverables, estimates)
     └── Approval button: captures name, email, timestamp
```

**API routes for public pages:**
- `GET /api/public/invoices/[token]` — Fetch invoice data
- `POST /api/public/invoices/[token]/pay` — Create Stripe PaymentIntent
- `GET /api/public/sow/[token]` — Fetch SOW data
- `POST /api/public/sow/[token]/approve` — Record SOW approval

## Email Notifications

Invoice link delivery uses **Resend** (consistent with proposal notifications):

- **Client invoice link**: Sent via Resend when admin enables sharing and clicks "Send". Email contains share link URL and invoice summary. Include both HTML and plain text versions.
- **Admin notifications**: In-app alerts for payment confirmation, overdue invoices. Optional email via Resend for payment received events.

## Activity System Integration

New target types and verb constants for the activity system.

**New target types** (add to `ActivityTargetType` in `lib/activity/types.ts`):
- `INVOICE`
- `SOW`

**New event files** (pure factory functions that return `ActivityEvent` objects — caller passes to `logActivity()`):

```
lib/activity/events/invoices.ts
├── invoiceCreatedEvent(invoiceId, userId)       → ActivityEvent
├── invoiceSentEvent(invoiceId, userId)           → ActivityEvent
├── invoicePaidEvent(invoiceId, userId)           → ActivityEvent
├── invoiceVoidedEvent(invoiceId, userId)         → ActivityEvent
├── invoiceRefundedEvent(invoiceId, userId)       → ActivityEvent
├── monthlyInvoicesGeneratedEvent(count, userId)  → ActivityEvent

lib/activity/events/scopes-of-work.ts
├── sowCreatedEvent(sowId, userId)                → ActivityEvent
├── sowSentForReviewEvent(sowId, userId)          → ActivityEvent
├── sowApprovedEvent(sowId, approverName)         → ActivityEvent
├── sowRevisionRequestedEvent(sowId, approverName)→ ActivityEvent
├── sowTasksGeneratedEvent(sowId, userId, count)  → ActivityEvent
├── sowVersionCreatedEvent(sowId, userId, version)→ ActivityEvent
```

**Usage pattern:**
```typescript
import { invoicePaidEvent } from '@/lib/activity/events/invoices'
import { logActivity } from '@/lib/activity/logger'
await logActivity(invoicePaidEvent(invoiceId, userId))
```

Re-export from `lib/activity/events.ts` following the existing pattern.
