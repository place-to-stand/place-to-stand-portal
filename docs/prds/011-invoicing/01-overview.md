# 01: Overview

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)

## Problem Statement

Place to Stand currently tracks prepaid hour blocks manually — an admin creates a record with hours purchased and an optional invoice number string. There is no:

1. **Invoice generation** — invoices are created outside the portal (or not at all), with no structured record of what was billed
2. **Payment processing** — clients pay via manual bank transfer or check, with no way to pay online
3. **Invoice-to-hours linkage** — the `invoiceNumber` field on hour blocks is a freeform string with no connection to an actual invoice record
4. **Client self-service** — no way for clients to view or pay invoices without back-and-forth email
5. **Billing visibility** — no centralized view of what's been invoiced, what's outstanding, and what's been paid

Meanwhile, the sharing infrastructure (proposals) has proven the pattern: generate a public link, track views, let clients take action. Invoicing is the natural next application of this pattern, with the addition of Stripe for payment processing.

## Strategic Context

Invoicing sits at the intersection of two existing systems:

- **Proposals** (upstream) — a signed proposal often leads to an invoice for the agreed work
- **Hour Blocks** (downstream) — a paid invoice for billable hours should automatically create hour block records

The invoicing system bridges this gap, creating a traceable chain: Proposal → Invoice → Payment → Hour Block.

## Design Principles

### Follow Existing Patterns

The invoicing feature should feel native to the portal. Every UI pattern, data layer convention, and architectural decision reuses established approaches:

- **Sharing** → proposals pattern (token, enable/disable, view tracking)
- **List + Sheet** → hour blocks pattern (table, slide-out form, tabs nav)
- **Archive + Activity** → same tab structure as hour blocks, clients, contacts
- **Soft deletes** → `deletedAt` timestamp, never hard delete active records
- **Server Actions** → same action/schema/types structure as hour blocks

### Payment Creates Truth

An invoice being marked as "paid" is only triggered by Stripe webhook confirmation — never by manual status change. This ensures:

- Hour blocks are only created when money has actually been received
- The `paidAt` timestamp reflects Stripe's confirmation, not admin intent
- Idempotent webhook handling prevents duplicate hour blocks

### Lightweight Product Catalog

Rather than building a full product/pricing system, v1 seeds a minimal catalog (development hours at $200/hr, server costs) that line items can reference. This provides:

- Consistent pricing for common items
- A foundation for future catalog expansion
- Flexibility for ad-hoc/incidental line items that don't need catalog entries

### Computed Over Stored

Following the project's established pattern, derived states like "overdue" are computed in queries (`dueDate < NOW() AND status NOT IN ('PAID', 'VOID')`), not stored as enum values that require background jobs to keep current.

## Scope

**This PRD covers:**

- New database tables: `invoices`, `invoice_line_items`, `product_catalog_items`
- PostgreSQL SEQUENCE for invoice numbering (`INV-0001` format)
- Stripe integration: package setup, checkout sessions, webhook handler
- Public invoice page at `/share/invoices/<token>` with payment button
- Share/unshare flow with view tracking (proposals pattern)
- Dashboard: list page, slide-out sheet for create/edit, archive page, activity page
- Navigation entry in the Sales group
- Auto-creation of hour blocks on payment for billable hour line items
- Activity events for the full invoice lifecycle
- Product catalog seeded with development hours and server costs
- PDF invoice generation via `@react-pdf/renderer` (attached to email on send)
- Email delivery via Resend on DRAFT→SENT transition
- Proposal-to-invoice conversion (create invoice from signed proposal)

**This PRD does NOT cover:**

- Recurring/subscription invoices
- Overdue reminders or automated follow-ups
- Configurable tax rate presets per client or jurisdiction (v1 has manual per-invoice tax rate input)
- Multi-currency support (USD only for v1)
- Stripe product/price catalog sync
- Client dashboard access to invoices
- Partial payments or payment plans
- Credit notes or refunds
- Admin UI for managing the product catalog
- Stripe Connect (for marketplace-style payments)

## Relationship to Existing Features

### Proposals (PRD sharing pattern)

Invoices reuse the proposals sharing infrastructure:
- Same `shareToken` / `shareEnabled` column pattern
- Same enable/disable API route pattern
- Same public page layout (`app/(public)/`)
- Same view tracking (atomic increment, skip for admins)

The key difference: invoices add a Stripe payment action instead of a signature flow.

### Hour Blocks

Currently, hour blocks have an optional `invoiceNumber` text field that stores a freeform string. This PRD:
- Adds an `invoiceId` UUID FK to the `hour_blocks` table
- Auto-creates hour block records when invoices with billable hour line items are paid via Stripe
- Preserves the existing `invoiceNumber` field for backwards compatibility with manually-entered records

### Activity System

Follows the established activity pattern:
- New `INVOICE` target type
- New verbs: `INVOICE_CREATED`, `INVOICE_UPDATED`, `INVOICE_SENT`, `INVOICE_VIEWED`, `INVOICE_PAID`, `INVOICE_VOIDED`, `INVOICE_SHARED`, `INVOICE_UNSHARED`, `INVOICE_ARCHIVED`, `INVOICE_RESTORED`
- Event handlers in `lib/activity/events/invoices.ts`
