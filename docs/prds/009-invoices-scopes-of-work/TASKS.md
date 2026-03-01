# PRD 009 — Implementation Task List

> **Last updated:** 2026-02-07 (Session 1 — initial creation)
>
> Update this file at the end of every session. Mark tasks complete, add notes, and record blockers.

## Status Legend

- [ ] Pending
- [x] Complete
- [~] In Progress (note which session started it)
- [!] Blocked (describe blocker)

---

## Phase 1 — Invoice Foundation + Stripe

### 1.1 Extract Shared Sharing Module
- [ ] Create `lib/sharing/tokens.ts` — extract `generateShareToken()` from `lib/data/proposals.ts`
- [ ] Create `lib/sharing/password.ts` — extract `hashSharePassword()`, `verifySharePassword()` from proposals
- [ ] Create `lib/sharing/view-tracking.ts` — generic `recordView()` helper
- [ ] Create `lib/sharing/types.ts` — `ShareableEntity` interface
- [ ] Update proposal code to import from `lib/sharing/` instead of local implementations
- [ ] Verify proposal public pages still work after extraction

**Complexity:** Low | **Dependencies:** None | **PRD Section:** [08-integration-architecture.md](./08-integration-architecture.md)

### 1.2 Invoice Schema + Enums + Billing Settings
- [ ] Add `invoice_status` enum to `lib/db/schema.ts`
- [ ] Add `line_item_type` enum to `lib/db/schema.ts`
- [ ] Add `invoices` table to `lib/db/schema.ts` (all columns, CHECK constraints)
- [ ] Add `invoice_line_items` table to `lib/db/schema.ts`
- [ ] Add `billing_settings` singleton table to `lib/db/schema.ts` (CHECK constraint on id)
- [ ] Create `invoice_number_seq` PostgreSQL SEQUENCE
- [ ] Add all indexes (filtered partial indexes on `deleted_at IS NULL`)
- [ ] Add UNIQUE partial index on `stripe_payment_intent_id`
- [ ] Add all relations to `lib/db/relations.ts`
- [ ] Create `lib/billing/constants.ts` with `BILLING_SETTINGS_ID` sentinel UUID
- [ ] Generate migration: `npm run db:generate -- --name add_invoices_and_billing`
- [ ] Review generated SQL
- [ ] Apply migration: `npm run db:migrate`
- [ ] Seed `billing_settings` singleton row (in migration or separate seed)
- [ ] Run `npm run type-check` to verify schema types

**Complexity:** Medium | **Dependencies:** None | **PRD Section:** [07-data-model-reference.md](./07-data-model-reference.md)

### 1.3 Stripe Integration Library
- [ ] Create `lib/integrations/stripe/client.ts` — lazy singleton SDK initialization
- [ ] Create `lib/integrations/stripe/payment-intents.ts` — `createPaymentIntent()`, `getPaymentIntent()`
- [ ] Create `lib/integrations/stripe/webhooks.ts` — `verifySignature()`, `handleWebhookEvent()`
- [ ] Add `stripe` npm package
- [ ] Add `@stripe/stripe-js` and `@stripe/react-stripe-js` for client-side Elements
- [ ] Verify env vars are documented: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

**Complexity:** Medium | **Dependencies:** None | **PRD Section:** [03-stripe-and-payments.md](./03-stripe-and-payments.md)

### 1.4 Invoice Queries & Data Layer
- [ ] Create `lib/queries/invoices.ts` — CRUD for invoices and line items
- [ ] Create `lib/queries/billing-settings.ts` — singleton read/write
- [ ] Create `lib/data/invoices/index.ts` — business logic (create, send, void)
- [ ] Create `lib/data/invoices/sharing.ts` — enable/disable sharing, view tracking
- [ ] Create `lib/data/billing-settings.ts` — cached singleton read with `cache()`, admin update
- [ ] Create `lib/invoices/types.ts` — invoice and line item types
- [ ] Create `lib/invoices/constants.ts` — status labels, number formatting
- [ ] Create `lib/invoices/number-generator.ts` — PG SEQUENCE invoice number generation
- [ ] Implement invoice immutability enforcement (PAID/VOID/REFUNDED cannot edit line items/totals)
- [ ] Implement subtotal/total recomputation on line item changes
- [ ] Implement invoice number assignment on DRAFT→SENT transition

**Complexity:** Medium | **Dependencies:** 1.2 | **PRD Section:** [02-invoice-system.md](./02-invoice-system.md)

### 1.5 Invoice Activity Events
- [ ] Add `INVOICE` to `ActivityTargetType` in `lib/activity/types.ts`
- [ ] Create `lib/activity/events/invoices.ts` with all event factory functions
- [ ] Re-export from `lib/activity/events.ts`

**Complexity:** Low | **Dependencies:** 1.2 | **PRD Section:** [08-integration-architecture.md](./08-integration-architecture.md)

### 1.6 Invoice Admin UI
- [ ] Add `/invoices` route under `app/(dashboard)/invoices/page.tsx`
- [ ] Replace "Hour Blocks" sidebar item with "Invoices" (admin-only)
- [ ] Build invoice list table component (number, client, status, total, due date, actions)
- [ ] Build invoice detail/editor sheet component
- [ ] Build create invoice form (client select, billing type detection, line item editor)
- [ ] Implement prepaid defaults (5hr pre-fill, 5/10/20/40 preset buttons)
- [ ] Build "Duplicate invoice" action
- [ ] Build invoice settings page at `/invoices/settings` (hourly rate, company info, prefix)
- [ ] Create server actions in `_actions/` for create, update, send, void, duplicate
- [ ] Wire up status badge with OVERDUE computed state
- [ ] Add filter controls (by status, by client)

**Complexity:** High | **Dependencies:** 1.2, 1.4 | **PRD Section:** [02-invoice-system.md](./02-invoice-system.md)

### 1.7 Public Invoice Page + Stripe Elements
- [ ] Create `app/(public)/invoice/[shareToken]/page.tsx` (server component)
- [ ] Create `invoice-client.tsx` (client component with Stripe Elements)
- [ ] Create `payment-form.tsx` (Stripe Elements payment form)
- [ ] Create `GET /api/public/invoices/[token]/route.ts` — fetch invoice data
- [ ] Create `POST /api/public/invoices/[token]/pay/route.ts` — create PaymentIntent
- [ ] Implement view tracking (SENT→VIEWED on first visit, with race condition guard)
- [ ] Add `noindex`/`nofollow` metadata
- [ ] Style with branded layout (company logo, address, etc.)

**Complexity:** High | **Dependencies:** 1.1, 1.3, 1.4 | **PRD Section:** [03-stripe-and-payments.md](./03-stripe-and-payments.md)

### 1.8 Stripe Webhook Endpoint
- [ ] Create `app/api/integrations/stripe/webhook/route.ts`
- [ ] Implement signature verification
- [ ] Handle `payment_intent.succeeded` → call `markInvoicePaid()`
- [ ] Handle `payment_intent.payment_failed` → log failure
- [ ] Handle `charge.refunded` → mark REFUNDED, log activity
- [ ] Return 200 for unknown events (Stripe best practice)

**Complexity:** Medium | **Dependencies:** 1.3, 1.4 | **PRD Section:** [03-stripe-and-payments.md](./03-stripe-and-payments.md)

### 1.9 markInvoicePaid + Hour Block Auto-Creation
- [ ] Create `lib/data/invoices/mark-paid.ts`
- [ ] Implement idempotency check (return early if already PAID)
- [ ] Implement transaction: update invoice status + create hour block(s) for prepaid
- [ ] Link hour blocks via `invoice_line_items.hour_block_id`
- [ ] Handle multiple HOURS_PREPAID line items (uncommon but supported)
- [ ] Fire activity event outside transaction
- [ ] Implement polling fallback: "Check Payment Status" button on invoice detail

**Complexity:** Medium | **Dependencies:** 1.4, 1.8 | **PRD Section:** [03-stripe-and-payments.md](./03-stripe-and-payments.md)

### 1.10 Invoice Email Notifications
- [ ] Create invoice link email template via Resend (HTML + plain text)
- [ ] Send email when admin clicks "Send" (invoice sharing enabled)
- [ ] Include invoice summary in email body (number, total, due date)
- [ ] Optional: admin notification on payment received

**Complexity:** Low | **Dependencies:** 1.4, 1.7 | **PRD Section:** [08-integration-architecture.md](./08-integration-architecture.md)

### 1.11 Legacy Hour Blocks Migration
- [ ] Remove old Hour Blocks page/sidebar item
- [ ] Ensure existing hour block records remain accessible via client detail
- [ ] Add read-only "Legacy Hour Blocks" section or redirect

**Complexity:** Low | **Dependencies:** 1.6 | **PRD Section:** [02-invoice-system.md](./02-invoice-system.md)

---

## Phase 2 — Monthly Cron + Dashboard

### 2.1 Time Log Summary Query
- [ ] Create `fetchTimeLogSummaryByProjectForClient()` in `lib/queries/time-logs.ts`
- [ ] Aggregate hours per project for a client within a date range
- [ ] Use timezone-aware boundaries (`America/Los_Angeles`)

**Complexity:** Low | **Dependencies:** 1.4 | **PRD Section:** [04-monthly-billing-cron.md](./04-monthly-billing-cron.md)

### 2.2 Monthly Invoice Cron Endpoint
- [ ] Create `app/api/cron/monthly-invoices/route.ts` (GET handler)
- [ ] Implement Bearer token auth matching `CRON_SECRET` pattern
- [ ] Query active net-30 clients
- [ ] Implement duplicate detection (skip if draft exists for same period)
- [ ] Create draft invoices with HOURS_WORKED line items per project
- [ ] Create `lib/data/invoices/monthly-generation.ts` for testability
- [ ] Return structured results: `{ generated, skipped, errors[] }`
- [ ] Add cron schedule to `vercel.json`

**Complexity:** Medium | **Dependencies:** 1.4, 2.1 | **PRD Section:** [04-monthly-billing-cron.md](./04-monthly-billing-cron.md)

### 2.3 Manual "Generate Now" Button
- [ ] Add "Generate Monthly Invoices" button to invoice UI
- [ ] Call the same monthly generation logic
- [ ] Show results (generated, skipped, errors)

**Complexity:** Low | **Dependencies:** 2.2 | **PRD Section:** [04-monthly-billing-cron.md](./04-monthly-billing-cron.md)

### 2.4 Dashboard Widgets
- [ ] Monthly revenue widget
- [ ] Outstanding invoices count badge
- [ ] Overdue invoice alerts (computed from `due_date`)

**Complexity:** Medium | **Dependencies:** 1.4 | **PRD Section:** [02-invoice-system.md](./02-invoice-system.md)

---

## Phase 3 — Scopes of Work + Version History

### 3.1 SOW Schema + Enums
- [ ] Add `sow_status` enum to `lib/db/schema.ts`
- [ ] Add `scopes_of_work` table to `lib/db/schema.ts`
- [ ] Add `sow_task_links` table to `lib/db/schema.ts`
- [ ] Add `sow_versions` table to `lib/db/schema.ts` (NOT NULL content_hash)
- [ ] Add `estimated_hours` NUMERIC(8,2) to `tasks` table (nullable)
- [ ] Add all indexes
- [ ] Add all relations to `lib/db/relations.ts`
- [ ] Generate migration: `npm run db:generate -- --name add_scopes_of_work`
- [ ] Review generated SQL
- [ ] Apply migration: `npm run db:migrate`
- [ ] Run `npm run type-check`

**Complexity:** Medium | **Dependencies:** None | **PRD Section:** [07-data-model-reference.md](./07-data-model-reference.md)

### 3.2 SOW Types + Zod Schemas
- [ ] Create `lib/scopes-of-work/types.ts` — `SOWContent`, `SOWPhase`, `SOWDeliverable`
- [ ] Create Zod schemas for runtime validation
- [ ] Ensure `SOWPhase.id` uses `nanoid()` for stable identification

**Complexity:** Low | **Dependencies:** None | **PRD Section:** [05-scopes-of-work.md](./05-scopes-of-work.md)

### 3.3 SOW Queries & Data Layer
- [ ] Create `lib/queries/scopes-of-work.ts` — SOW CRUD, version queries
- [ ] Create `lib/queries/sow-task-links.ts` — link table operations
- [ ] Create `lib/data/scopes-of-work/index.ts` — business logic (create, update status)
- [ ] Create `lib/data/scopes-of-work/sharing.ts` — share token management
- [ ] Recompute `total_estimated_hours` on every content save

**Complexity:** Medium | **Dependencies:** 3.1, 3.2 | **PRD Section:** [05-scopes-of-work.md](./05-scopes-of-work.md)

### 3.4 SOW Editor UI
- [ ] Create `app/(dashboard)/projects/[clientSlug]/[projectSlug]/scopes/page.tsx`
- [ ] Create `scopes/[sowId]/page.tsx`
- [ ] Build SOW list component with status badges
- [ ] Build phase builder (add/remove/reorder phases with deliverables)
- [ ] Build hour estimate calculator (running total)
- [ ] Build preview mode (client-facing document view)
- [ ] Build share controls (reuse proposal sharing pattern)
- [ ] Add "Scopes" tab to project navigation
- [ ] Create server actions in `_actions/`

**Complexity:** High | **Dependencies:** 3.1, 3.3 | **PRD Section:** [05-scopes-of-work.md](./05-scopes-of-work.md)

### 3.5 SOW Sharing + Public Page
- [ ] Create `app/(public)/sow/[shareToken]/page.tsx`
- [ ] Render SOW content (phases, deliverables, estimates)
- [ ] Create `GET /api/public/sow/[token]/route.ts`
- [ ] Add `noindex`/`nofollow` metadata
- [ ] Use shared `lib/sharing/` module for token validation

**Complexity:** Medium | **Dependencies:** 1.1, 3.3 | **PRD Section:** [05-scopes-of-work.md](./05-scopes-of-work.md)

### 3.6 SOW Approval Flow
- [ ] Create `POST /api/public/sow/[token]/approve/route.ts`
- [ ] Build approval button UI with name/email capture
- [ ] Validate SOW is in `IN_REVIEW` status before accepting
- [ ] Rate-limit approval endpoint
- [ ] Guard against replay (allow once only)
- [ ] Record `approved_at`, `approved_by_name`, `approved_by_email`
- [ ] Implement `REVISION_REQUESTED` status path

**Complexity:** Medium | **Dependencies:** 3.5 | **PRD Section:** [05-scopes-of-work.md](./05-scopes-of-work.md)

### 3.7 Proposal-to-SOW Transform
- [ ] Create `lib/scopes-of-work/transform-from-proposal.ts`
- [ ] Map `ProposalPhase.purpose` → `SOWPhase.description`
- [ ] Map `ProposalPhase.deliverables` (string[]) → `SOWDeliverable[]`
- [ ] Generate fresh `nanoid()` IDs for each phase
- [ ] Initialize `estimatedHours` to 0
- [ ] Wire into SOW creation UI as optional pre-populate

**Complexity:** Low | **Dependencies:** 3.2 | **PRD Section:** [05-scopes-of-work.md](./05-scopes-of-work.md)

### 3.8 SOW Version History
- [ ] Create `lib/data/scopes-of-work/version-history.ts`
- [ ] Implement canonical JSON content hashing (deeply sorted keys, SHA-256)
- [ ] Create version on save (if content hash differs from last version)
- [ ] Create version on status transitions
- [ ] Build version history timeline UI (History button in SOW editor)
- [ ] Implement "Restore this version" (creates new version with old content)

**Complexity:** Medium | **Dependencies:** 3.3 | **PRD Section:** [06-sow-tasks-and-versions.md](./06-sow-tasks-and-versions.md)

### 3.9 SOW Activity Events
- [ ] Add `SOW` to `ActivityTargetType` in `lib/activity/types.ts`
- [ ] Create `lib/activity/events/scopes-of-work.ts` with all event factory functions
- [ ] Re-export from `lib/activity/events.ts`

**Complexity:** Low | **Dependencies:** 3.1 | **PRD Section:** [08-integration-architecture.md](./08-integration-architecture.md)

---

## Phase 4 — SOW-to-Task Generation

### 4.1 sow_task_links Schema + estimated_hours
- [ ] Verify `sow_task_links` table and indexes from 3.1 migration
- [ ] Verify `tasks.estimated_hours` column from 3.1 migration
- [ ] Create queries for link CRUD in `lib/queries/sow-task-links.ts`

**Complexity:** Low | **Dependencies:** 3.1 | **PRD Section:** [06-sow-tasks-and-versions.md](./06-sow-tasks-and-versions.md)

### 4.2 Task Generation Engine
- [ ] Create `lib/data/scopes-of-work/task-generation.ts`
- [ ] Convert approved SOW phases into BACKLOG tasks (one per phase)
- [ ] Set task title from phase title (e.g., "Phase 1: Discovery & Architecture")
- [ ] Set `estimated_hours` from `SOWPhase.estimatedHours`
- [ ] Create `sow_task_links` rows with stable `phase_id`
- [ ] Transition SOW status to `IN_PROGRESS` after generation
- [ ] Fire activity event

**Complexity:** Medium | **Dependencies:** 3.3, 4.1 | **PRD Section:** [06-sow-tasks-and-versions.md](./06-sow-tasks-and-versions.md)

### 4.3 Task Sheet SOW Integration
- [ ] Update task sheet to query `sow_task_links` for linked SOW phase
- [ ] Render SOW phase content (description, deliverables, estimated hours) in task sheet
- [ ] Handle soft-deleted SOWs gracefully (placeholder or fallback to task's own content)
- [ ] Show SOW phase content alongside task's own description

**Complexity:** Medium | **Dependencies:** 4.1, 4.2 | **PRD Section:** [06-sow-tasks-and-versions.md](./06-sow-tasks-and-versions.md)

### 4.4 SOW Detail Task Status Display
- [ ] Show generated tasks and their statuses on SOW detail view
- [ ] Visual indicator of phase completion based on linked task status
- [ ] Editing SOW phase reflects immediately in linked task view

**Complexity:** Low | **Dependencies:** 4.2, 4.3 | **PRD Section:** [06-sow-tasks-and-versions.md](./06-sow-tasks-and-versions.md)

---

## Session Log

| Session | Date | Tasks Completed | Notes |
|---------|------|-----------------|-------|
| 1 | 2026-02-07 | — | Initial PRD split and task list creation |
