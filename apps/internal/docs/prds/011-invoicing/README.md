---
title: '011: Invoicing & Stripe Payments'
status: 'draft'
author: 'Jason Desiderio'
date: '2026-03-10'
---

# 011: Invoicing & Stripe Payments

## Overview

Add invoicing to the portal with Stripe payment processing. Invoices are shareable via public links (same pattern as proposals), trackable for client views, and when paid, automatically create hour block records for billable hours. A lightweight product catalog provides the foundation for standardized line items.

See [01-overview.md](./01-overview.md) for full problem statement, scope, and design principles.

## Documents

### Specification

| Document | Contents | Read when... |
|----------|----------|-------------|
| [01-overview.md](./01-overview.md) | Problem statement, scope, design principles | Starting the project or onboarding someone |
| [02-data-model.md](./02-data-model.md) | Schema: invoices, line items, product catalog, sequences, enums | Working on Phase 1 (data model) |
| [03-stripe-integration.md](./03-stripe-integration.md) | Stripe setup, checkout sessions, webhook handling, idempotency | Working on Phase 2 (Stripe) |
| [04-sharing-and-public-page.md](./04-sharing-and-public-page.md) | Share/unshare flow, public invoice page, view tracking, payment UI | Working on Phase 4 (sharing + public) |
| [05-dashboard-ui.md](./05-dashboard-ui.md) | List page, sheet form, archive, activity, navigation | Working on Phase 3 (dashboard) |
| [06-hour-block-automation.md](./06-hour-block-automation.md) | Auto-creating hour blocks on payment, line item flagging | Working on Phase 5 (automation) |
| [07-future-enhancements.md](./07-future-enhancements.md) | Client top-up, recurring invoices, overdue reminders, etc. | Planning future work |
| [08-email-and-pdf.md](./08-email-and-pdf.md) | PDF generation, email delivery on send via Resend | Working on Phase 6 (email & PDF) |
| [09-proposal-to-invoice.md](./09-proposal-to-invoice.md) | Proposal-to-invoice conversion, pre-fill, traceability | Working on Phase 7 (proposal-to-invoice) |

### Tracking

| Document | Contents | Read when... |
|----------|----------|-------------|
| [PROGRESS.md](./PROGRESS.md) | Phase status, session log, key files modified | Starting a coding session |
| [TEST-PLAN.md](./TEST-PLAN.md) | Manual test cases by phase with pass/fail tracking | Testing after implementation |

## Implementation Phases & Dependencies

```
Phase 1: Data Model                              ← Start here
├── 02-data-model.md (schema, migration, product catalog seed)
└── No dependencies

Phase 2: Stripe Integration                      ← depends on Phase 1
├── 03-stripe-integration.md (package, env, checkout, webhook)
└── Requires: invoices + line_items tables exist

Phase 3: Dashboard UI                            ← depends on Phase 1
├── 05-dashboard-ui.md (list, sheet, archive, activity, nav)
└── Requires: invoices table + queries exist
└── Can run in parallel with Phase 2

Phase 4: Sharing & Public Page                   ← depends on Phases 1, 2
├── 04-sharing-and-public-page.md (share link, public page, payment button)
└── Requires: invoices table + Stripe checkout ready

Phase 5: Hour Block Automation                   ← depends on Phases 1, 2
├── 06-hour-block-automation.md (auto-create hour blocks on payment)
└── Requires: webhook handler + hour blocks query layer

Phase 6: Email & PDF                             ← depends on Phases 1, 3, 4
├── 08-email-and-pdf.md (PDF generation, email delivery via Resend)
└── Requires: invoice data model + public page URL for email link

Phase 7: Proposal-to-Invoice                     ← depends on Phases 1, 3
├── 09-proposal-to-invoice.md (create invoice from signed proposal)
└── Requires: invoice sheet + proposals data
```

**Parallelization**: Phases 2 and 3 can run in parallel after Phase 1. Phase 4 requires both 1 and 2. Phase 5 is a focused addition to the webhook handler from Phase 2. Phases 6 and 7 can run in parallel after their dependencies are met.

## Resolved Decisions

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Invoice number format | `INV-0001` via PostgreSQL SEQUENCE | Concurrent-safe auto-increment. Number assigned on DRAFT→SENT transition, not on creation. Prevents gaps from abandoned drafts. |
| Overdue status | **Computed, not stored** | Derived from `dueDate < NOW()` in queries. Stored enum values go stale (per project memory). |
| Product catalog editability | **Seeded, admin-editable later** | v1 seeds development hours ($200) and server costs. Admin UI for catalog management is deferred to [07-future-enhancements.md](./07-future-enhancements.md). |
| Password protection on shared invoices | **Deferred** | Invoices are less sensitive than proposals (no signatures, no legal terms). Token-only sharing is sufficient for v1. |
| Sharing pattern | **Reuse proposals pattern** | Same `shareToken` / `shareEnabled` / `viewedAt` / `viewedCount` columns. Same enable/disable API pattern. Same public page layout. |
| Stripe product catalog sync | **Deferred** | v1 creates Stripe checkout sessions with ad-hoc line items. Syncing to Stripe Products/Prices adds complexity with minimal v1 benefit. |
| Invoice-to-hour-block linkage | **One-directional** | `hour_blocks.invoiceId` FK → `invoices.id`. Navigate from hour block to invoice. Avoids bidirectional FK concerns (per project memory). |
| Hour block creation trigger | **Stripe webhook** | Only create hour blocks on confirmed payment (`checkout.session.completed`). Never on invoice creation or status change. |
| Line item types | **Product catalog reference** | Line items optionally reference a `product_catalog_items` row. Custom/incidental items have `productCatalogItemId = NULL` with freeform description. |
| Navigation placement | **Sales group, between Proposals and Hour Blocks** | Natural flow: Leads → Proposals → Invoices → Hour Blocks |
| Public invoice URL | `/share/invoices/<token>` | Consistent with `/share/proposals/<token>` pattern |
| Stripe webhook endpoint | `/api/integrations/stripe` | Follows existing integration pattern (`/api/integrations/leads-intake`) |
| Activity target type | `INVOICE` | New entry in `ActivityTargetType` union |
| Client access | **Admin-only for v1** | Clients can view public invoice link but cannot see invoices in the dashboard |
| Invoice association | **Client-only** | Invoices always require a client. No optional lead linkage (unlike proposals). Convert leads to clients before invoicing. |
| Hour block granularity | **Separate block per line item** | Each qualifying line item creates its own hour block on payment. More granular tracking than one combined block. |
| Hourly rate | **$200/hr default, admin-adjustable per invoice** | Product catalog defaults to $200/hr. Admin can adjust the unit price on any line item. No per-client rate overrides for v1. |
| Send + share coupling | **Send requires sharing** | The "Send" action both assigns the invoice number AND enables the share link. They are coupled — no offline-only invoicing for v1. |
| Post-payment redirect | **Back to invoice page** | Stripe redirects to the same public invoice URL with `?payment=success` banner. No separate thank-you page. |
| Void + sharing | **Keep link active, show "Voided"** | Voiding does NOT disable sharing. The public page still loads but shows a voided state with no payment button. |
| List filtering | **Just pagination for v1** | Simple paginated list sorted by created date desc. Client/status filtering deferred. |
| Payment notifications | **No notifications for v1** | Payment shows in the activity feed. Gmail self-send and in-app notifications deferred. |
| Public page design | **Traditional invoice layout** | Formal document look: company header, bill-to section, itemized table, totals. Printable. |
| Edit after send | **Editable while SENT, locked at VIEWED** | SENT invoices are editable (client hasn't seen it yet). Once VIEWED, locked. Editing SENT clears Stripe session. To change after VIEW, void and create new. |
| Incidentals flow | **Catalog + freeform** | Select from product catalog or type a custom description. No dedicated incidentals UI. |
| Tax UI | **Full tax UI in v1** | Tax rate input in the invoice sheet, tax breakdown on the public page. |
| Stripe API version | **SDK default (latest at install)** | Omit `apiVersion` from client config. SDK uses its bundled latest version. Update by upgrading the `stripe` npm package. |
| Undo/redo | **Full undo/redo** | Match the hour blocks sheet pattern with Cmd+Z / Cmd+Shift+Z and fixed footer bar. |
| Stripe session expiry | **Handle `checkout.session.expired`** | Clear `stripeCheckoutSessionId` so a new session can be created. Invoice stays SENT/VIEWED. |
| Webhook reliability | **Inline processing, no queue for v1** | Stripe retries with exponential backoff for 3 days. Processing is lightweight (~50ms). Queue (Inngest/waitUntil) deferred to future. |
| Email delivery on send | **Resend with PDF attachment** | Email sent to client contacts on DRAFT→SENT. Fire-and-forget — email failure doesn't block the send action. |
| PDF generation | **`@react-pdf/renderer`, on-demand** | Same library as executed proposals. Generated on-the-fly for email attachment. Stored PDFs deferred. |
| Proposal-to-invoice | **v1 scope, pre-fill from proposal** | "Create Invoice" action on signed proposals. Pre-fills client + line items. Admin reviews as DRAFT before sending. |
| Hour block idempotency | **ON CONFLICT DO NOTHING via unique index** | Unique partial index on `hour_blocks(invoice_line_item_id)` prevents duplicates atomically. No TOCTOU race condition. |
| Archived invoice webhooks | **Still process payment** | If invoice is archived mid-checkout, webhook still marks PAID and creates hour blocks. Logs warning. Does NOT unarchive. |
| Proposal-to-invoice pre-fill | **Client + 5hr Dev Hours line item** | Pre-fills client and a single "Development Hours" line item at 5 hours (minimum billable block). Admin adjusts hours before saving. |
| Due date default | **Based on client billing type** | `net_30` clients → 30 days from today. `prepaid` clients → blank (upon receipt). Admin can always override. |
| Minimum billable hours | **5-hour minimum, soft warning** | Yellow warning if hour block line items have quantity < 5. Advisory only — does not block saving. |
| Checkout session expiry | **Auto-recreate on expired** | Stripe's 24hr max is unavoidable. When session expires, `checkout.session.expired` clears the ID. Next "Pay Now" click seamlessly creates a fresh session. |
| Invoice email sender | **Shared RESEND_FROM_EMAIL** | Same env var as other portal emails (`portal@notifications.placetostandagency.com`). No dedicated invoices@ address needed. |
