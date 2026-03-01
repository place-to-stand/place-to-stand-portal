# PRD 009 — Manual Test Plan

> **Last updated:** 2026-02-07 (Session 1 — initial creation)
>
> Update this file at the end of every session. Check off verified tests, add regression notes, and flag new edge cases.

## Status Legend

- [ ] Not tested
- [x] Passed
- [!] Failed (describe issue)
- [~] Partially tested (describe what's missing)
- [N/A] Not yet implementable

---

## Phase 1 — Invoice Foundation + Stripe

### T1.1 Shared Sharing Module

- [ ] `generateShareToken()` produces valid 32-char hex strings
- [ ] `validateToken()` accepts 32-char and 64-char hex tokens
- [ ] `hashSharePassword()` and `verifySharePassword()` round-trip correctly
- [ ] Existing proposal public pages still work after extraction (no regressions)
- [ ] Proposal share links with passwords still validate

### T1.2 Invoice Schema

- [ ] `billing_settings` table has exactly one row after migration
- [ ] Attempting to insert a second `billing_settings` row fails (CHECK constraint)
- [ ] `billing_settings` UPSERT works correctly
- [ ] `invoices` table accepts all valid statuses
- [ ] `invoice_number` UNIQUE constraint prevents duplicates
- [ ] `invoice_number` CHECK constraint validates format (`^[A-Z0-9]{2,10}-\d{4}-\d{4,}$`)
- [ ] `invoice_line_items.amount` CHECK constraint enforces `amount = quantity * unit_price`
- [ ] Partial indexes only include non-deleted rows
- [ ] `stripe_payment_intent_id` UNIQUE partial index works (NULL allowed, non-NULL unique)
- [ ] Soft delete (`deleted_at`) excludes rows from filtered indexes

### T1.3 Invoice CRUD

- [ ] Create a draft invoice for a prepaid client
- [ ] Create a draft invoice for a net-30 client
- [ ] Add `HOURS_PREPAID` line item with default 5 hours
- [ ] Add `HOURS_WORKED` line item
- [ ] Add `CUSTOM` line item
- [ ] Subtotal recomputes correctly when line items change
- [ ] Total = subtotal + tax
- [ ] Edit draft invoice line items (add, modify, remove)
- [ ] Cannot edit line items on PAID invoice (immutability)
- [ ] Cannot edit line items on VOID invoice (except notes)
- [ ] Cannot edit line items on REFUNDED invoice
- [ ] Soft-delete a draft invoice
- [ ] Void an invoice

### T1.4 Invoice Numbering

- [ ] Draft invoices have NULL `invoice_number`
- [ ] Sending a draft assigns `invoice_number` via SEQUENCE
- [ ] Invoice number format matches `PREFIX-YYYY-NNNN` pattern
- [ ] Concurrent sends produce unique numbers (no duplicates)
- [ ] Custom prefix from `billing_settings` is used correctly

### T1.5 Invoice Sharing & Public Page

- [ ] Enable sharing generates a `share_token`
- [ ] Share link opens public invoice page
- [ ] Public page renders company branding, line items, totals
- [ ] First visit transitions status to VIEWED (only from SENT)
- [ ] VIEWED transition does NOT happen if invoice is already PAID
- [ ] `noindex`/`nofollow` meta tags present
- [ ] Invalid share token returns 404
- [ ] Disabled share token returns 404

### T1.6 Stripe Payment Flow

- [ ] Stripe Elements payment form renders on public invoice page
- [ ] Submitting payment creates a PaymentIntent with correct amount
- [ ] Successful card payment triggers `payment_intent.succeeded` webhook
- [ ] Webhook handler calls `markInvoicePaid()` successfully
- [ ] Invoice status transitions to PAID
- [ ] `paid_at` timestamp is set
- [ ] `payment_method` is recorded correctly
- [ ] Failed payment triggers `payment_intent.payment_failed` (no status change)
- [ ] Full refund triggers `charge.refunded` → status REFUNDED
- [ ] Partial refund is logged but does not change status

### T1.7 markInvoicePaid Idempotency

- [ ] Calling `markInvoicePaid()` on already-PAID invoice returns early (no error)
- [ ] Duplicate webhook events do NOT create duplicate hour blocks
- [ ] Transaction rolls back cleanly on failure (no partial state)

### T1.8 Prepaid Hour Block Auto-Creation

- [ ] Paying a prepaid invoice creates an `hour_block` record
- [ ] Hour block has correct hours matching the `HOURS_PREPAID` line item quantity
- [ ] Line item's `hour_block_id` is set to the new hour block
- [ ] Multiple `HOURS_PREPAID` line items create separate hour blocks
- [ ] Hour block is visible in client detail page

### T1.9 Invoice Email

- [ ] Sending invoice triggers email via Resend
- [ ] Email contains share link URL
- [ ] Email contains invoice summary (number, total, due date)
- [ ] Email has both HTML and plain text versions

### T1.10 Duplicate Invoice

- [ ] Duplicating an invoice creates a new DRAFT
- [ ] Duplicated line items do NOT carry over `hour_block_id`
- [ ] Soft-deleted line items are NOT duplicated
- [ ] Duplicate invoice has no `invoice_number` (assigned on send)

### T1.11 Invoice Settings

- [ ] Settings page loads current billing_settings values
- [ ] Updating hourly rate persists correctly
- [ ] Updating company name/address persists
- [ ] Updating invoice number prefix persists
- [ ] Updated rate is used for new invoices
- [ ] Existing invoices are NOT affected by rate changes

### T1.12 Legacy Hour Blocks

- [ ] Old Hour Blocks sidebar item is removed
- [ ] Existing hour block records remain accessible
- [ ] Historical hour blocks visible in client detail

### T1.13 Invoice Admin UI

- [ ] Invoice list renders with correct columns
- [ ] Filter by status works
- [ ] Filter by client works
- [ ] OVERDUE badge displays for invoices past due date (not PAID/VOID/REFUNDED)
- [ ] Prepaid invoice creation pre-fills 5 hours
- [ ] Quick-select buttons (5, 10, 20, 40) update quantity
- [ ] Invoice detail sheet opens and shows all data
- [ ] Action buttons (Send, Mark Paid, Void) work correctly
- [ ] Only admins can access `/invoices` (client role cannot)

### T1.14 Activity Events

- [ ] Invoice created event logged
- [ ] Invoice sent event logged
- [ ] Invoice paid event logged
- [ ] Invoice voided event logged
- [ ] Invoice refunded event logged
- [ ] Events appear in activity feed

---

## Phase 2 — Monthly Cron + Dashboard

### T2.1 Time Log Summary Query

- [ ] Query returns correct hours per project for a client in date range
- [ ] Timezone boundaries use `America/Los_Angeles`
- [ ] Only CLIENT-type projects are included
- [ ] Deleted time logs are excluded

### T2.2 Monthly Cron

- [ ] Cron endpoint requires Bearer token auth (`CRON_SECRET`)
- [ ] Generates draft invoices for all active net-30 clients
- [ ] Creates one `HOURS_WORKED` line item per project
- [ ] Skips clients with no time logs in the period
- [ ] Duplicate detection: skips client if draft already exists for same period
- [ ] Returns structured results: `{ generated, skipped, errors[] }`
- [ ] Partial failure: earlier clients' invoices persist even if later client fails
- [ ] Does NOT generate invoices for prepaid clients

### T2.3 Manual Generate Button

- [ ] "Generate Monthly Invoices" button is visible on invoice UI
- [ ] Triggers same logic as cron
- [ ] Shows results to admin
- [ ] Duplicate detection prevents double-creation

### T2.4 Dashboard Widgets

- [ ] Monthly revenue widget shows correct total
- [ ] Outstanding invoices count is accurate
- [ ] Overdue alerts display for invoices past due date

---

## Phase 3 — Scopes of Work + Version History

### T3.1 SOW Schema

- [ ] `scopes_of_work` table created with all columns
- [ ] `sow_task_links` table created with UNIQUE constraint
- [ ] `sow_versions` table created with NOT NULL `content_hash`
- [ ] `tasks.estimated_hours` column added (nullable, no breakage)
- [ ] All indexes created correctly

### T3.2 SOW CRUD

- [ ] Create a new SOW for a project
- [ ] Edit SOW content (phases, deliverables, risks, assumptions)
- [ ] Add/remove/reorder phases
- [ ] Each phase gets a stable `nanoid()` ID
- [ ] `total_estimated_hours` recomputed on save
- [ ] Soft-delete a SOW
- [ ] SOW content validates against Zod schema

### T3.3 SOW Editor UI

- [ ] "Scopes" tab appears in project navigation
- [ ] SOW list displays with status badges
- [ ] Phase builder works: add phase, add deliverables, set hours
- [ ] Running total updates as phases are edited
- [ ] Preview mode shows client-facing document
- [ ] Reordering phases updates `index` but preserves `id`

### T3.4 SOW Sharing & Public Page

- [ ] Enable sharing generates share token
- [ ] Public SOW page renders all content correctly
- [ ] Phases, deliverables, and estimates display properly
- [ ] `noindex`/`nofollow` meta tags present
- [ ] Invalid token returns 404

### T3.5 SOW Approval

- [ ] Approval button visible on public SOW page (when IN_REVIEW)
- [ ] Approval captures name and email
- [ ] Approval records timestamp
- [ ] Approval only accepted when SOW is IN_REVIEW
- [ ] Cannot approve same SOW twice (replay guard)
- [ ] Status transitions to APPROVED after approval
- [ ] REVISION_REQUESTED status path works
- [ ] Rate limiting on approval endpoint

### T3.6 Proposal-to-SOW Transform

- [ ] Creating SOW with linked proposal pre-populates content
- [ ] `ProposalPhase.purpose` maps to `SOWPhase.description`
- [ ] `ProposalPhase.deliverables` (strings) map to `SOWDeliverable` objects
- [ ] `estimatedHours` initialized to 0
- [ ] Fresh `nanoid()` IDs generated (not copied from proposal)

### T3.7 Version History

- [ ] Saving SOW creates a version snapshot (if content differs)
- [ ] Status transition creates a version snapshot
- [ ] Identical saves do NOT create duplicate versions (content_hash dedup)
- [ ] Version history UI shows timeline with authors and timestamps
- [ ] "Restore this version" creates a new version with old content
- [ ] Content hash uses deeply sorted keys (not `JSON.stringify()`)
- [ ] `version_number` increments correctly

### T3.8 SOW Activity Events

- [ ] SOW created event logged
- [ ] SOW sent for review event logged
- [ ] SOW approved event logged
- [ ] SOW revision requested event logged
- [ ] SOW tasks generated event logged
- [ ] SOW version created event logged

---

## Phase 4 — SOW-to-Task Generation

### T4.1 Task Generation

- [ ] "Generate Tasks" button visible on approved SOWs
- [ ] One task created per phase in BACKLOG status
- [ ] Task title matches phase title
- [ ] Task `estimated_hours` set from phase estimate
- [ ] `sow_task_links` rows created with correct `phase_id`
- [ ] SOW transitions to IN_PROGRESS after generation
- [ ] Activity event logged

### T4.2 Task Sheet Integration

- [ ] Task sheet shows linked SOW phase content
- [ ] SOW phase description and deliverables render correctly
- [ ] Editing SOW phase updates task sheet display (live read)
- [ ] Task can have its own description alongside SOW content
- [ ] Soft-deleted SOW shows "SOW archived" placeholder (not crash)

### T4.3 SOW-Task Status Display

- [ ] SOW detail view shows generated tasks
- [ ] Each phase shows its linked task's current status
- [ ] Status updates reflect when task moves through workflow
- [ ] Orphaned links (deleted phase) show warning

---

## Cross-Cutting Concerns

### Security

- [ ] Public invoice page is rate-limited
- [ ] Public SOW page is rate-limited
- [ ] SOW approval endpoint is rate-limited
- [ ] Share tokens are cryptographically random
- [ ] Stripe webhook signature verified on every request
- [ ] Admin-only routes reject CLIENT role users
- [ ] No sensitive data leaked in public API responses

### Performance

- [ ] Invoice list loads efficiently with pagination
- [ ] SOW list loads efficiently
- [ ] Version history queries perform well with many versions
- [ ] `billing_settings` uses `cache()` for deduplication

### Data Integrity

- [ ] Invoice totals always match SUM(line_items.amount)
- [ ] Soft-deleted records excluded from all active queries
- [ ] ON DELETE behaviors work as specified (RESTRICT, CASCADE, SET NULL)
- [ ] Invoice number SEQUENCE produces no gaps under normal operation

---

## Regression Checklist

> Run these after every significant change to catch regressions.

- [ ] Existing proposal sharing still works
- [ ] Existing hour blocks are accessible
- [ ] Client detail page still shows hour block summary
- [ ] Activity feeds display correctly for all entity types
- [ ] Dashboard loads without errors
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes

---

## Session Log

| Session | Date | Tests Verified | Notes |
|---------|------|---------------|-------|
| 1 | 2026-02-07 | — | Initial test plan creation |
