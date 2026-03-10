# Test Plan

> Part of [PRD 011: Invoicing & Stripe Payments](./README.md)
> Manual test cases organized by phase.

## Phase 1: Data Model

### 1.1 Migration
- [ ] `npm run db:generate -- --name add_invoicing` succeeds
- [ ] Generated SQL creates all expected tables, enums, indexes, sequence
- [ ] `npm run db:migrate` applies without errors
- [ ] Product catalog seed data is present (3 items)

### 1.2 Schema Validation
- [ ] `npm run type-check` passes with new schema types
- [ ] Invoice status enum has all 5 values
- [ ] `hour_blocks.invoice_id` column exists with SET NULL delete behavior
- [ ] `hour_blocks.invoice_line_item_id` column exists with unique partial index
- [ ] `invoices.client_id` has RESTRICT delete behavior
- [ ] `product_catalog_items.creates_hour_block_default` column exists

## Phase 2: Stripe Integration

### 2.1 Checkout Session
- [ ] `POST /api/invoices/[id]/checkout` creates Stripe session for SENT invoice
- [ ] Returns session URL
- [ ] Rejects DRAFT invoices (400)
- [ ] Rejects PAID invoices (400)
- [ ] Rejects VOID invoices (400)
- [ ] Rejects invoices with sharing disabled (400)
- [ ] Idempotent: second call returns same session if still open

### 2.2 Public Checkout
- [ ] `POST /api/public/invoices/[token]/checkout` works without auth
- [ ] Rejects invalid tokens (404)
- [ ] Rejects disabled share tokens (404)

### 2.3 Webhook
- [ ] `POST /api/integrations/stripe` verifies webhook signature
- [ ] Rejects invalid signatures (400)
- [ ] `checkout.session.completed` updates invoice to PAID
- [ ] Sets `stripePaymentIntentId` and `paidAt`
- [ ] Idempotent: duplicate webhook doesn't double-process
- [ ] `checkout.session.expired` clears `stripeCheckoutSessionId`
- [ ] After session expiry, a new checkout session can be created
- [ ] Unknown event types return 200 (no error)
- [ ] Archived invoice mid-checkout: payment still processed, warning logged

### 2.4 Local Development
- [ ] `stripe listen --forward-to localhost:3000/api/integrations/stripe` works
- [ ] Test payment flow completes end-to-end

## Phase 3: Dashboard UI

### 3.1 Navigation
- [ ] "Invoices" appears in Sales group between Proposals and Hour Blocks
- [ ] Active state highlights correctly on `/invoices`, `/invoices/archive`, `/invoices/activity`

### 3.2 List Page
- [ ] Invoice list loads with pagination
- [ ] Table shows correct columns (number, client, status, total, due date, issued)
- [ ] Status badges display with correct colors
- [ ] Overdue indicator shows for past-due SENT/VIEWED invoices
- [ ] Empty state displays when no invoices exist

### 3.3 Invoice Sheet
- [ ] Sheet opens in create mode with one empty line item
- [ ] Client combobox shows all clients
- [ ] Product catalog combobox shows active items
- [ ] Selecting a catalog item auto-fills description, unit price, creates_hour_block
- [ ] Adding/removing line items works
- [ ] Tax rate input accepts percentage (e.g., 8.75)
- [ ] Tax amount computes correctly (subtotal × tax rate)
- [ ] Totals compute correctly (subtotal, tax, total)
- [ ] Save creates invoice with line items
- [ ] Edit mode loads existing data correctly
- [ ] Undo/redo works (Cmd+Z, Cmd+Shift+Z)
- [ ] Cmd+S saves the form
- [ ] Unsaved changes warning on close
- [ ] Selecting a net_30 client auto-sets due date to 30 days from today
- [ ] Selecting a prepaid client leaves due date blank
- [ ] Changing client updates the due date default
- [ ] Admin can override auto-defaulted due date
- [ ] Dev Hours line item with quantity < 5 shows minimum hours warning
- [ ] Warning is advisory only — saving still works with quantity < 5

### 3.4 Editability Rules
- [ ] DRAFT invoices are fully editable
- [ ] SENT invoices are editable (client hasn't seen it yet)
- [ ] Editing a SENT invoice clears stripeCheckoutSessionId
- [ ] Editing a SENT invoice preserves invoice number and share token
- [ ] VIEWED invoices open in read-only mode (locked at first view)
- [ ] PAID invoices open in read-only mode
- [ ] VOID invoices open in read-only mode

### 3.5 Actions
- [ ] Send (DRAFT→SENT): assigns invoice number, sets issued date, enables sharing
- [ ] Send generates share token and sets shareEnabled=true
- [ ] Void (DRAFT/SENT/VIEWED→VOID): marks as void, keeps sharing active
- [ ] Archive: sets deletedAt, disappears from active list
- [ ] Restore: clears deletedAt, reappears in active list
- [ ] Destroy: hard deletes from archive, line items cascade

### 3.6 Archive Page
- [ ] Shows archived invoices only
- [ ] Restore and Destroy actions work
- [ ] Destroy confirmation dialog appears

### 3.7 Activity Page
- [ ] Activity feed loads for INVOICE target type
- [ ] Shows create, update, send, void, archive, restore events
- [ ] Load more pagination works

## Phase 4: Sharing & Public Page

### 4.1 Share Flow
- [ ] Share dialog opens from table action
- [ ] "Generate Shareable Link" creates token and enables sharing
- [ ] URL displays correctly
- [ ] Copy button copies URL to clipboard
- [ ] "Disable Sharing" sets shareEnabled to false
- [ ] Re-enabling sharing reuses the same token
- [ ] Quick copy from table row works when sharing is enabled

### 4.2 Public Page
- [ ] `/share/invoices/[token]` renders the invoice
- [ ] Shows invoice number, client, dates, line items, totals
- [ ] Invalid token shows 404
- [ ] Disabled sharing shows 404

### 4.3 View Tracking
- [ ] First view increments viewedCount and sets viewedAt
- [ ] First view transitions SENT→VIEWED
- [ ] Subsequent views increment count but don't change status
- [ ] Admin sessions skip view tracking
- [ ] View count displays in share dialog

### 4.4 Void + Sharing
- [ ] Voiding a shared invoice does NOT disable sharing
- [ ] Public page for voided invoice shows "Voided" state
- [ ] No "Pay Now" button on voided public page
- [ ] Admin can still manually disable sharing on a voided invoice

### 4.5 Payment Flow
- [ ] "Pay Now" button appears for SENT/VIEWED invoices
- [ ] Clicking "Pay Now" redirects to Stripe Checkout
- [ ] Success redirect shows confirmation message
- [ ] Cancel redirect shows retry message
- [ ] After webhook: page shows "Paid" status, no pay button
- [ ] VOID invoices show voided message, no pay button

## Phase 5: Hour Block Automation

### 5.1 Creation
- [ ] Paying an invoice with `createsHourBlock` line items creates hour blocks
- [ ] Hour block has correct: clientId, hoursPurchased, invoiceId, invoiceLineItemId, invoiceNumber
- [ ] Multiple qualifying line items create multiple hour blocks
- [ ] Non-qualifying line items (createsHourBlock=false) are skipped
- [ ] Zero-quantity line items are skipped

### 5.2 Idempotency
- [ ] Duplicate webhook doesn't create duplicate hour blocks (ON CONFLICT DO NOTHING)
- [ ] Concurrent webhook deliveries don't create duplicate hour blocks

### 5.3 Traceability
- [ ] Hour block shows invoice number in the list
- [ ] Activity log shows "Auto-created from invoice INV-XXXX"

### 5.4 Edge Cases
- [ ] Invoice with no qualifying line items: no hour blocks created, no error
- [ ] Invoice hard-deleted: hour blocks survive with invoiceId = NULL

## Phase 6: Email & PDF

### 6.1 PDF Generation
- [ ] PDF renders with correct layout (header, bill-to, line items, totals)
- [ ] PDF includes invoice number, issue date, due date
- [ ] PDF line items match invoice line items
- [ ] PDF totals include subtotal, tax rate label, tax amount, total
- [ ] PDF includes notes section when notes are present
- [ ] PDF footer includes public invoice URL

### 6.2 Email Delivery
- [ ] Sending an invoice triggers email to client contacts
- [ ] Email subject includes invoice number and total amount
- [ ] Email body includes "View & Pay Online" link
- [ ] PDF is attached to the email
- [ ] Email sent to all client contacts (multiple recipients)
- [ ] No error when client has no contacts (email skipped, warning logged)
- [ ] Invoice still marked SENT even if email delivery fails
- [ ] Email `from` address uses verified Resend domain

### 6.3 Edge Cases
- [ ] PDF generation failure: email sent without attachment, error logged
- [ ] Resend API error: invoice still sent, error logged
- [ ] Client with no email contacts: invoice sent, no email, warning logged

## Phase 7: Proposal-to-Invoice

### 7.1 Conversion
- [ ] "Create Invoice" action appears on signed/accepted proposals
- [ ] Action not available on unsigned proposals
- [ ] Action not available on proposals without a client
- [ ] Invoice sheet opens pre-filled with client from proposal
- [ ] Single "Development Hours" line item pre-filled with 5 hours × hourly rate from proposal
- [ ] Due date auto-defaults based on client billing type
- [ ] Invoice notes reference the proposal title
- [ ] Created invoice has `proposalId` FK set

### 7.2 Duplicate Prevention
- [ ] Warning shown when proposal already has an associated invoice
- [ ] Admin can proceed despite warning (multiple invoices per proposal allowed)

### 7.3 Traceability
- [ ] Activity log shows proposal source in creation event
- [ ] Invoice retains data if source proposal is deleted (SET NULL on FK)

### 7.4 Edge Cases
- [ ] Proposal with no billable content: invoice created with empty line items
- [ ] Admin adjusts pre-filled data before saving (not auto-committed)
