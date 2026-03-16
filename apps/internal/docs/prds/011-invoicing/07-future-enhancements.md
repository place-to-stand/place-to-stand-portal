# 07: Future Enhancements

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)
> Not in scope for v1 — reference for future planning

## Client Hour Block Top-Up

Allow clients to purchase additional hours directly from the portal without admin-initiated invoicing. This is the highest-priority future enhancement — it completes the self-service billing loop.

**Potential approach:**
- "Buy More Hours" button on the client-facing hour blocks page
- Pre-configured packages (e.g., 10 hours, 20 hours, 40 hours)
- Creates an invoice + Stripe Checkout session in one step
- Auto-creates hour block on payment (reuses existing automation)
- No admin involvement needed for standard packages

## Payment Notifications

Notify admins when invoices are paid.

**Potential approach:**
- Gmail self-send notification to the invoice creator (matching proposals pattern)
- In-app indicator (badge on Invoices nav item)
- Configurable notification preferences

## Overdue Reminders

Automated follow-up for unpaid invoices past their due date.

**Potential approach:**
- Vercel Cron job checks for overdue invoices daily
- Sends reminder email via Resend (with configurable cadence: 1 day, 7 days, 14 days after due)
- Activity log entry for each reminder sent
- Admin can disable reminders per invoice

## Recurring Invoices

Automatically generate invoices on a schedule (monthly, quarterly) for clients with ongoing engagements.

**Potential approach:**
- `invoice_schedules` table with recurrence rules (frequency, next run, template line items)
- Vercel Cron job generates draft invoices from schedules
- Admin reviews and sends each generated invoice
- Avoids fully-automatic billing without human review

## List Filtering & Sorting

Add filtering and sorting to the invoice list page.

**Potential approach:**
- Filter by client (combobox)
- Filter by status (multi-select)
- Filter by date range (date picker pair)
- Sort by date, amount, client name
- URL-based filter state for shareability

## Client Dashboard Access

Let CLIENT-role users see their invoices in the dashboard.

**Potential approach:**
- Filter invoices by client membership (same as projects/tasks scoping)
- Read-only view (no create/edit/archive)
- Payment action from dashboard (redirect to Stripe Checkout)

## Tax Configuration

Support for configurable tax rates per client or jurisdiction.

**Potential approach:**
- `tax_rates` table with rate, label, jurisdiction
- Default tax rate in settings
- Per-client tax rate override
- Per-invoice tax rate selection

## Admin Product Catalog UI

Settings page for managing the product catalog.

**Potential approach:**
- `app/(dashboard)/settings/product-catalog/` with list + sheet pattern
- CRUD operations for catalog items
- Soft delete to preserve historical references

## Invoice Templates

Pre-configured invoice templates with standard line items for common engagement types.

**Potential approach:**
- `invoice_templates` table with name and default line items (JSONB)
- "Create from template" option in the add button
- Pre-fills client, line items, notes from template

## Stripe Product/Price Sync

Sync the local product catalog to Stripe Products and Prices.

**Potential approach:**
- Store `stripeProductId` and `stripePriceId` on catalog items
- Sync on catalog item create/update
- Use Stripe Prices in checkout sessions instead of ad-hoc `price_data`
- Enables Stripe Dashboard reporting by product

## Multi-Currency Support

Support invoicing in currencies other than USD.

**Potential approach:**
- `currency` field on invoices (ISO 4217 code)
- Stripe handles multi-currency natively
- Exchange rate capture at time of invoicing

## Partial Payments & Payment Plans

Support paying invoices in installments.

**Potential approach:**
- `payment_schedule` table linking to invoice
- Multiple Stripe checkout sessions per invoice
- Track partial payments against total
- Status: PARTIALLY_PAID between SENT and PAID

## Credit Notes & Refunds

Issue credit notes against paid invoices and process Stripe refunds.

**Potential approach:**
- `credit_notes` table referencing the original invoice
- Stripe Refund API integration
- Credit balance tracking per client

## Batch Operations

Select multiple invoices for bulk actions.

**Potential approach:**
- Checkbox column in the table
- Bulk archive, bulk void, bulk resend
- Bulk share (generate links for all selected)

## Webhook Queue Infrastructure

Move webhook processing to a background job queue for reliability and observability.

**Potential approach:**
- Use Inngest or Trigger.dev for reliable, retryable background jobs
- Alternatively, use Vercel's `waitUntil()` for lightweight fire-and-forget
- Add dead-letter pattern for failed processing
- Enables heavier processing without blocking the webhook response

## Financial Reporting

Dashboard widgets and reports for invoice analytics.

**Potential approach:**
- Outstanding balance by client
- Monthly revenue from paid invoices
- Average time to payment
- Overdue invoice aging report
- Integration with Monthly Close reports page
