# Progress

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)
> Updated after each coding session.

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| 1: Data Model | Complete | Schema, migration, product catalog seed, relations, activity types |
| 2: Stripe Integration | Complete | Stripe client, checkout routes (admin + public), webhook handler |
| 3: Dashboard UI | Complete | List, sheet (full form with line items), archive, activity, nav, tabs |
| 4: Sharing & Public Page | Complete | Share/unshare API routes, public invoice page, view tracking, payment flow |
| 5: Hour Block Automation | Complete | createHourBlocksFromInvoice in webhook handler |
| 6: Email & PDF | Complete | jsPDF invoice generation, Resend email delivery on send |
| 7: Proposal-to-Invoice | Complete | mapProposalToInvoiceDefaults, "Create Invoice" action on proposals |

## Key Files Created

### Phase 1 — Data Model
- `lib/db/schema.ts` — Added `invoiceStatus` enum, `productCatalogItems`, `invoices`, `invoiceLineItems` tables
- `lib/db/relations.ts` — Added invoice relations
- `lib/activity/types.ts` — Added INVOICE target type and verbs
- `lib/activity/events/invoices.ts` — Invoice lifecycle event builders
- `drizzle/migrations/0042_add_invoicing.sql` — Migration with SEQUENCE + seed data

### Phase 2 — Stripe Integration
- `lib/stripe/client.ts` — Stripe SDK initialization
- `app/api/invoices/[id]/checkout/route.ts` — Admin checkout session creation
- `app/api/public/invoices/[token]/checkout/route.ts` — Public checkout
- `app/api/integrations/stripe/route.ts` — Webhook handler
- `lib/data/invoices.ts` — createHourBlocksFromInvoice

### Phase 3 — Dashboard UI
- `app/(dashboard)/invoices/page.tsx` — Active invoices list
- `app/(dashboard)/invoices/archive/page.tsx` — Archived invoices
- `app/(dashboard)/invoices/activity/page.tsx` — Activity feed
- `app/(dashboard)/invoices/invoice-sheet.tsx` — Full slide-out form with line items
- `app/(dashboard)/invoices/_components/` — All table, tabs, button, dialog components
- `app/(dashboard)/invoices/actions/` — All server actions (save, send, void, archive, restore, destroy)
- `lib/invoices/invoice-form.ts` — Form types, Zod schema, defaults, payload builder
- `lib/invoices/invoice-options.ts` — Client and catalog option builders
- `lib/invoices/invoice-ui-state.ts` — Pure state derivation functions
- `lib/invoices/use-invoice-sheet-state.ts` — Sheet logic hook
- `lib/queries/invoices.ts` — Query layer
- `lib/queries/product-catalog.ts` — Product catalog queries

### Phase 4 — Sharing & Public Page
- `app/api/invoices/[id]/share/route.ts` — Enable sharing
- `app/api/invoices/[id]/unshare/route.ts` — Disable sharing
- `app/(public)/share/invoices/[token]/page.tsx` — Public invoice page
- `app/(public)/share/invoices/[token]/public-invoice.tsx` — Invoice document UI

### Phase 6 — Email & PDF
- `lib/invoices/invoice-pdf.ts` — jsPDF invoice generation
- `lib/email/send-invoice-email.ts` — Resend email template and sender

### Phase 7 — Proposal-to-Invoice
- `lib/invoices/proposal-to-invoice.ts` — mapProposalToInvoiceDefaults helper
- Updated `app/(dashboard)/proposals/_components/proposal-detail-sheet.tsx` — "Create Invoice" action
