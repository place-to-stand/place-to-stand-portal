---
title: '009: Invoices & Scopes of Work'
status: 'draft'
author: 'Jason Desiderio'
date: '2026-02-07'
---

# 009: Invoices & Scopes of Work

## 1. Overview

This document outlines the requirements for adding invoice management and scope-of-work (SOW) generation to the portal. The goal is to bring billing operations closer to the engineering workflow, automate monthly invoice generation for net-30 clients, and connect accepted SOWs to project task creation.

### 1.1 Current State

- **Invoicing**: Invoices are currently created and sent manually through QuickBooks. When a prepaid client pays, an admin manually records the hour block in the portal via the Hour Blocks screen (`/hour-blocks` in the Sales sidebar) — a basic CRUD screen where invoice data is copied in by hand. Net-30 clients are invoiced on the 1st of each month based on time logs, but the tally and invoice creation happen outside the portal. This PRD moves invoicing entirely into the portal with Stripe as the payment processor.
- **Hour Blocks UI (to be replaced)**: The current `/hour-blocks` screen is a stopgap. It lets admins manually enter purchased hours and an invoice number after a payment is received elsewhere. This PRD replaces that screen with a full invoice management interface. The underlying `hour_blocks` table remains as the data model for tracking prepaid hours, but hour block records will be created automatically when invoices are paid rather than entered by hand.
- **Scopes of Work**: Proposals capture phases, deliverables, risks, and rates in structured JSONB content (see `lib/proposals/` and `lib/data/proposals.ts` — the proposal system was built without a numbered PRD). Once a proposal is accepted and countersigned, the transition from proposal to actionable project tasks is manual — there is no formal SOW document that breaks down phases into estimated hours and feeds into task creation.
- **Version Control**: The portal has no document versioning. Tasks and proposals are edited in place with no history trail beyond the activity log.

### 1.2 Goals

1. **Centralize invoice lifecycle** — Generate, share, and track invoices from within the portal. Public-facing invoice pages with embedded Stripe payment.
2. **Automate monthly billing** — Vercel Cron on the 1st of each month generates draft invoices for net-30 clients. Prepaid invoices remain manual.
3. **Auto-credit hour blocks** — When a prepaid invoice is paid via Stripe, automatically create the corresponding hour block record.
4. **Stripe payment integration** — Embedded Stripe Elements on the public invoice page for card/ACH payment. Stripe webhooks for real-time payment confirmation.
5. **Configurable rates** — Invoice settings screen with global hourly rate (starting at $200/hr).
6. **Formalize scopes of work** — SOWs live inside projects, contain phased hour estimates and deliverables, and require client approval (simple button, not signature) before work begins.
7. **SOW-to-task generation** — Accepted SOWs produce one task per phase. Tasks link back to the SOW phase and read content live (no content duplication).
8. **SOW version history** — Version snapshots for SOW content to track changes through the review/approval cycle.

### 1.3 Out of Scope

- Stripe's built-in invoicing feature (we build our own invoice UI/document; Stripe is payment processing only).
- Automated contract/legal document generation beyond SOW structure.
- Full audit trail for every field change on every entity (activity logs continue to serve that purpose).
- Per-client custom rates (future — global rate for now; schema supports `COALESCE(client.hourly_rate, billing_settings.hourly_rate)` extension).
- Invoice status audit trail / history table (future — could follow `lead_stage_history` pattern).
- SOW templates (future — compatible with current JSONB content structure).
- Multi-currency (future — `currency` field on invoices provides foundation).

---

## 2. Invoices

### 2.1 Billing Models Recap

The portal supports two client billing types (existing `billing_type` enum on `clients`):

| Model       | How It Works                                                                                     | Invoice Trigger                                                           |
| ----------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **Prepaid** | Client purchases hour blocks upfront. Work draws down from the balance.                          | Admin creates invoice manually when client requests more hours.           |
| **Net 30**  | Client is billed monthly for actual hours worked in the prior month. Payment due within 30 days. | Automated on the 1st of each month via Vercel Cron (draft for review). |

### 2.2 Invoice Data Model

A new `invoices` table to track the full lifecycle of each invoice:

```
invoices
├── id                  UUID PRIMARY KEY
├── client_id           UUID NOT NULL (FK → clients, ON DELETE RESTRICT)
├── status              invoice_status ENUM
├── invoice_number      TEXT UNIQUE                -- Auto-generated via PG SEQUENCE: "INV-2026-0001"
│                                                  -- CHECK (invoice_number ~ '^[A-Z0-9]{2,10}-\d{4}-\d{4,}$')
│                                                  -- Must accommodate billing_settings.invoice_number_prefix
│                                                  -- (validate prefix at settings write time too)
│                                                  -- Nullable: assigned on DRAFT → SENT transition
├── billing_period_start DATE                      -- NULL for prepaid ad-hoc
├── billing_period_end   DATE                      -- NULL for prepaid ad-hoc
├── subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0  -- Must equal SUM(line_items.amount)
│                                                         -- Initialized to 0 on DRAFT creation,
│                                                         -- recomputed on every line item change
├── tax                 NUMERIC(12,2) NOT NULL DEFAULT 0  -- CHECK (total >= subtotal)
├── total               NUMERIC(12,2) NOT NULL DEFAULT 0  -- subtotal + tax
│                                                         -- Initialized to 0 on DRAFT creation
├── currency            VARCHAR(3) DEFAULT 'USD'
├── due_date            DATE
├── paid_at             TIMESTAMP
├── sent_at             TIMESTAMP
├── share_token         VARCHAR(64) UNIQUE         -- For public invoice link (like proposals)
├── share_enabled       BOOLEAN DEFAULT false
├── stripe_payment_intent_id TEXT                  -- Stripe PaymentIntent ID
│                                                  -- UNIQUE partial index WHERE NOT NULL
├── stripe_payment_status    TEXT                  -- Stripe status cache: 'requires_payment_method',
│                                                  -- 'requires_confirmation', 'processing', 'succeeded',
│                                                  -- 'canceled', 'requires_action'
├── payment_method      TEXT                       -- How payment was received: 'stripe_card',
│                                                  -- 'stripe_ach', 'manual', 'wire' (future-proofing)
├── notes               TEXT
├── created_by          UUID NOT NULL (FK → users, ON DELETE RESTRICT)
├── created_at          TIMESTAMP
├── updated_at          TIMESTAMP
├── deleted_at          TIMESTAMP                  -- Soft delete
```

**Indexes:**
- `idx_invoices_client (client_id) WHERE deleted_at IS NULL`
- `idx_invoices_status (status) WHERE deleted_at IS NULL`
- `idx_invoices_share_token (share_token) WHERE deleted_at IS NULL AND share_token IS NOT NULL AND share_enabled = true`
- `idx_invoices_billing_period (billing_period_start, billing_period_end) WHERE deleted_at IS NULL`
- `idx_invoices_created_by (created_by) WHERE deleted_at IS NULL`
- `idx_invoices_due_date (due_date) WHERE deleted_at IS NULL AND status NOT IN ('PAID', 'VOID', 'REFUNDED')`
- `UNIQUE partial on stripe_payment_intent_id WHERE stripe_payment_intent_id IS NOT NULL`

**Invoice immutability rule:** Invoices in terminal states (`PAID`, `VOID`, `REFUNDED`) are immutable — line items, totals, and client_id cannot be modified. Only `notes` can be updated on void invoices. Enforce in the application layer.

**Invoice statuses** (`invoice_status` enum):

| Status           | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `DRAFT`          | Created but not yet shared with client.                      |
| `SENT`           | Share link enabled and sent to client (email or link copy).  |
| `VIEWED`         | Client opened the shared invoice page. **Guard:** Only transition to VIEWED if current status is `SENT`. If the invoice is already `PAID` or a later state, skip the VIEWED update to prevent a race condition where the payment webhook fires before the view-tracking write. |
| `PAID`           | Payment received and confirmed via Stripe webhook.           |
| `PARTIALLY_PAID` | Partial payment received. Stripe PaymentIntents are all-or-nothing, so this status is only triggered by manual admin override (e.g., recording a partial wire transfer). |
| `REFUNDED`       | Payment fully refunded via Stripe (`charge.refunded` webhook). **Partial refunds** are out of scope for v1 — the `charge.refunded` handler checks `refund.amount === payment_intent.amount` and only transitions to `REFUNDED` on full refund. Partial refunds are logged but do not change invoice status. If partial refund support is needed later, add a `PARTIALLY_REFUNDED` status and a `refunded_amount` column. |
| `VOID`           | Cancelled/voided.                                            |

**Note on `OVERDUE`:** Overdue is a **computed state**, not a stored enum value. An invoice is overdue when `due_date < NOW() AND status NOT IN ('PAID', 'VOID', 'REFUNDED')`. The UI and queries derive this from `due_date` rather than storing a status that could go stale. This avoids needing a background job to transition invoices to OVERDUE.

### 2.3 Invoice Line Items

Each invoice contains one or more line items:

```
invoice_line_items
├── id                  UUID PRIMARY KEY
├── invoice_id          UUID NOT NULL (FK → invoices, ON DELETE CASCADE)
├── type                line_item_type ENUM
├── description         TEXT NOT NULL
├── quantity            NUMERIC(8,2) NOT NULL      -- Hours, units, or 1 for flat
├── unit_price          NUMERIC(12,2) NOT NULL     -- Rate per unit
├── amount              NUMERIC(12,2) NOT NULL     -- CHECK (amount = quantity * unit_price)
├── hour_block_id       UUID (FK → hour_blocks, ON DELETE SET NULL)  -- Links to credited hour block
├── metadata            JSONB                      -- Flexible extra data
├── sort_order          INTEGER NOT NULL DEFAULT 0
├── created_at          TIMESTAMP
├── updated_at          TIMESTAMP
├── deleted_at          TIMESTAMP                  -- Soft delete (consistent with project pattern)
```

**Indexes:**
- `idx_invoice_line_items_invoice (invoice_id) WHERE deleted_at IS NULL`
- `idx_invoice_line_items_hour_block (hour_block_id) WHERE deleted_at IS NULL AND hour_block_id IS NOT NULL`

**Line item types** (`line_item_type` enum):

| Type            | Use Case                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `HOURS_PREPAID` | Prepaid hour block purchase (e.g., "10 hours @ $X/hr").                                                                          |
| `HOURS_WORKED`  | Net-30 billable hours for the period.                                                                                            |
| `CUSTOM`        | Any additional charge — server hosting, CMS fees, one-off charges, credits, adjustments. Admin writes in description and amount. |

**No dedicated incidentals table.** Recurring costs like server hosting or CMS fees are added as `CUSTOM` line items directly on the invoice. This keeps the model simple — the admin adds whatever line items are needed when creating or editing a draft invoice. If a client consistently has the same charges, those line items can be duplicated from a previous invoice (see "Duplicate invoice" in Section 2.8).

**Hour block linkage:** The `invoice_line_items.hour_block_id` FK is the canonical link between a line item and the hour block it purchased. Rather than also adding `invoice_id` to `hour_blocks` (which creates a bidirectional FK sync concern), we navigate from hour block → line item → invoice through the `hour_block_id` FK. This avoids maintaining two FKs that must stay in sync. Querying an hour block's originating invoice is a cheap indexed join.

### 2.4 Prepaid Hour Block Defaults

- **Default quantity**: 5 hours (pre-filled in the UI).
- **Minimum**: Configurable per-client or globally. Start with 5-hour minimum.
- **Emergency override**: Admin can manually set quantity to 1 hour (UI allows going below minimum with a confirmation).
- **Common presets**: Quick-select buttons for 5, 10, 20, and 40 hours.

When creating a prepaid invoice:

1. Admin selects client, chooses hours (defaults to 5).
2. Invoice is created with a single `HOURS_PREPAID` line item.
3. Admin can add additional `CUSTOM` line items as needed (server costs, CMS fees, etc.).
4. On send → invoice status moves to `SENT`.
5. On payment confirmation → status moves to `PAID` and an `hour_block` record is automatically created with the purchased hours. The `HOURS_PREPAID` line item's `hour_block_id` is set to the new hour block.

### 2.5 Monthly Invoice Generation (Vercel Cron)

A Vercel Cron job runs on the **1st of each month** (e.g., `"0 10 1 * *"` — 10:00 UTC / 5:00 AM EST or 6:00 AM EDT). Defined in `vercel.json`, it hits an API route that generates draft invoices.

**Net-30 clients only.** Prepaid invoices are always created manually by the admin when a client requests more hours. The cron does not generate prepaid invoices.

**Steps:**

1. Query all active clients with `billing_type = 'net_30'`.
2. **Duplicate detection:** For each client, check if a draft invoice already exists for the same billing period (`billing_period_start` + `billing_period_end`). If so, skip that client and log a skip reason. This prevents duplicate drafts if the cron runs twice or the manual fallback is used in the same month.
3. For each net-30 client, query `time_logs` for all CLIENT-type projects where `logged_on` falls within the previous calendar month. **Use timezone-aware date boundaries** matching the existing time log aggregation pattern (`America/Los_Angeles`): `logged_on >= first_of_previous_month AND logged_on < first_of_current_month`.
4. Create one `HOURS_WORKED` line item **per project** (e.g., "Project Alpha — 12 hrs @ $X/hr", "Project Beta — 8 hrs @ $X/hr").
5. Create invoice in `DRAFT` status for admin review.
6. Admin reviews the draft, adds any `CUSTOM` line items (server costs, CMS fees, etc.), then sends.

**Partial failure handling:** If the cron generates invoices for 10 clients and fails on client 5, the first 4 invoices are already created in DRAFT status. This is acceptable — drafts require manual review anyway. The cron returns structured results (`{ generated: number, skipped: number, errors: string[] }`) for admin visibility.

**Fallback:** A manual "Generate Monthly Invoices" button in the invoice UI triggers the same logic on demand, in case the cron is missed or needs to be re-run. The duplicate detection check prevents double-creation.

### 2.6 Public Invoice Page & Stripe Payment

**Public invoice page** — Invoices have a share link (like proposals) that opens a fully branded, public-facing invoice page. The page shows:

- Company logo, name, and address.
- Client name and contact info.
- Invoice number, date, due date, payment terms.
- Line items table with descriptions, quantities, rates, and amounts.
- Subtotal, tax (if applicable), and total.
- **Embedded Stripe Elements** payment form for card or ACH payment.

**Payment flow:**

1. Admin creates invoice in the portal (DB record, `DRAFT` status).
2. Admin enables sharing (generates `share_token`), sends the link to the client via email (using Resend, consistent with proposal notifications).
3. Invoice status moves to `SENT`. When client opens the page → `VIEWED`.
4. Client fills in the embedded Stripe Elements payment form and submits.
5. Portal creates a Stripe PaymentIntent for the invoice total.
6. On successful payment, Stripe webhook (`payment_intent.succeeded`) fires to `POST /api/integrations/stripe/webhook`.
7. Portal calls the shared `markInvoicePaid()` function (see below).

**Shared `markInvoicePaid()` function** (`lib/data/invoices/mark-paid.ts`):

Both the webhook handler and the polling fallback call this same idempotent function:

1. Look up invoice by `stripe_payment_intent_id`.
2. **Idempotency check:** If invoice is already `PAID`, return early (200 OK). This prevents duplicate hour block creation when Stripe delivers the same event multiple times.
3. **Transaction:** Begin database transaction:
   - Update invoice: `status = PAID`, `paid_at = now()`, `payment_method = 'stripe_card'` (or `'stripe_ach'`).
   - If prepaid: For **each** `HOURS_PREPAID` line item, create a separate `hour_block` record with that line item's `quantity` as hours. Update each line item's `hour_block_id`. (Multiple HOURS_PREPAID line items on one invoice = multiple hour blocks. This is uncommon but supported — e.g., different rates for rush vs. standard hours.)
4. Commit transaction.
5. Log activity event (fire-and-forget, outside transaction).

**Stripe integration layer:**

- `lib/integrations/stripe/client.ts` — Stripe SDK initialization (lazy singleton, uses `STRIPE_SECRET_KEY`).
- `lib/integrations/stripe/payment-intents.ts` — Create/retrieve PaymentIntent for invoice amount.
- `lib/integrations/stripe/webhooks.ts` — Webhook event handler and signature verification.
- `POST /api/integrations/stripe/webhook` — Webhook endpoint.

**Naming note:** The existing Gmail integration lives at `lib/gmail/`, not `lib/integrations/gmail/`. Stripe is placed under `lib/integrations/stripe/` to establish the pattern for future third-party integrations. Consider migrating `lib/gmail/` → `lib/integrations/gmail/` in a future cleanup for consistency (out of scope for this PRD).

**Webhook handler pattern:**

```
1. Verify Stripe signature (STRIPE_WEBHOOK_SECRET)
2. Extract payment_intent_id from event
3. Look up invoice by stripe_payment_intent_id
4. If invoice not found, return 200 (Stripe recommends acknowledging unknown events)
5. Call markInvoicePaid() — idempotent, handles already-paid case
6. Return 200
```

**Webhook events to handle:**

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Call `markInvoicePaid()`. Creates hour block if prepaid. Logs activity. |
| `payment_intent.payment_failed` | Log failure. No status change (client can retry). |
| `charge.refunded` | Mark invoice `REFUNDED`. Log activity. |

**Note on event ordering:** Stripe does not guarantee event delivery order. The handler uses `payment_intent.succeeded` as the authoritative signal and does not depend on receiving `payment_intent.created` first.

**Polling fallback:** A manual "Check Payment Status" button queries Stripe's PaymentIntent API directly and calls the same `markInvoicePaid()` function. Idempotent — safe to call multiple times.

### 2.7 Invoice Settings

A settings tab at `/invoices/settings` for configuring billing defaults:

- **Hourly rate**: Single global rate, starting at $200/hr. Used as the default `unit_price` when generating line items.
- **Company info**: Company name, logo, and address displayed on the public invoice page (may pull from a shared company settings config).
- **Payment terms**: Default due date offset (e.g., "Net 30" = 30 days from invoice date).
- **Invoice number prefix**: Default "INV" with year, but configurable.

Rates are stored in a `billing_settings` singleton table:

```
billing_settings
├── id                  UUID PRIMARY KEY           -- Fixed sentinel: '00000000-0000-0000-0000-000000000001'
│                                                  -- CHECK (id = '00000000-0000-0000-0000-000000000001')
│                                                  -- Ensures exactly one row can exist
├── hourly_rate         NUMERIC(12,2) NOT NULL DEFAULT 200.00
├── company_name        TEXT
├── company_address     TEXT
├── company_logo_url    TEXT
├── default_payment_terms_days INTEGER DEFAULT 30
├── invoice_number_prefix TEXT DEFAULT 'INV'
├── created_at          TIMESTAMP                  -- Schema consistency
├── updated_at          TIMESTAMP
├── updated_by          UUID (FK → users, ON DELETE SET NULL)
```

**Singleton pattern:** The CHECK constraint on `id` ensures only one row can exist. Writes use `INSERT ... ON CONFLICT (id) DO UPDATE` (upsert). The fixed UUID is defined as a constant in application code:

```typescript
// lib/billing/constants.ts
export const BILLING_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'
```

**Future-proofing for per-client rates:** The global `hourly_rate` serves as the default. When per-client rates are needed later, add an `hourly_rate` column to the `clients` table and resolve with `COALESCE(client.hourly_rate, billing_settings.hourly_rate)` at invoice generation time. The line item already stores `unit_price` per row, so historical invoices are unaffected.

**Seeded in migration:** The singleton row is inserted as part of the migration that creates the table.

### 2.8 Invoice UI

**Replaces Hour Blocks**: The new Invoices screen replaces the current "Hour Blocks" menu item in the Sales sidebar section. The underlying `hour_blocks` table continues to store prepaid hour balances, but records are now created automatically when invoices are paid via Stripe — admins no longer manually enter them.

**Location**: `/invoices` route in the **Sales** sidebar section (replaces the Hour Blocks item). Admin-only — clients view and pay invoices via the public share link. **Note:** The existing Sales sidebar section has `roles: ['ADMIN', 'CLIENT']` (e.g., Hour Blocks is visible to both roles). The Invoices item should be `roles: ['ADMIN']` only, since clients pay via public share links and should not see the admin invoice management UI.

**Views:**

- **Invoice list**: Table with columns for invoice number, client, status, total, due date, sent date, paid date. Filterable by status and client. This replaces the current hour blocks table which only showed purchased hours and invoice numbers.
- **Invoice detail/editor**: Sheet or dedicated page showing line items, totals, client info, and action buttons (Send, Mark Paid, Void).
- **Create invoice**: Sheet form — select client, billing type auto-detected, pre-populated line items based on type (hours for prepaid, time log summary for net-30). For prepaid clients, default to 5-hour blocks with quick-select presets. Admin can add `CUSTOM` line items for server costs, CMS fees, or any other charges.
- **Duplicate invoice**: Action on any existing invoice to create a new draft with the same line items (excluding soft-deleted line items and clearing `hour_block_id` references from the copies). Useful for clients with recurring custom charges (e.g., monthly server + CMS costs) — duplicate last month's invoice, adjust as needed.
- **Hour block history**: The invoice detail view for prepaid invoices shows the linked hour block (via `invoice_line_items.hour_block_id`) that was auto-created on payment, preserving visibility into the data that the old Hour Blocks screen provided.

**Migration from Hour Blocks screen:**

- Existing hour block records remain untouched in the database.
- The old Hour Blocks settings page is removed.
- Historical hour blocks (created before invoices existed) are still visible via the client detail page's hour summary or a read-only "Legacy Hour Blocks" section.

**Dashboard integration:**

- Monthly revenue widget on the main dashboard.
- Outstanding invoices count badge.
- Overdue invoice alerts.

---

## 3. Scopes of Work

### 3.1 Relationship to Proposals

The existing proposal system (PRD 008) handles pre-engagement sales documents — pitching the engagement, capturing signatures, and establishing terms. A **Scope of Work** is the operational document that follows:

```
Proposal (Sales)          →  Scope of Work (Operations)      →  Tasks (Execution)
─────────────────────         ──────────────────────────          ────────────────
"Here's what we'll do        "Here are the specific phases,     Individual work items
 and what it costs"           deliverables, and hour estimates   with detailed PRDs
                              for phase 1"
```

**Key distinction:**

- **Proposal**: Tied to a lead or client. Sales document. Signed before engagement begins.
- **SOW**: Tied to a project. Operational document. Created after the proposal is accepted and a project exists. May be the first thing done on a paid scoping engagement.

A project may have **multiple SOWs** over its lifetime (initial scope + iteration scopes).

### 3.2 SOW Data Model

```
scopes_of_work
├── id                  UUID PRIMARY KEY
├── project_id          UUID NOT NULL (FK → projects, ON DELETE CASCADE)
├── proposal_id         UUID (FK → proposals, ON DELETE SET NULL)  -- Optional link to originating proposal
├── title               TEXT NOT NULL                -- e.g., "Phase 1: MVP Development"
├── status              sow_status ENUM
├── version             INTEGER NOT NULL DEFAULT 1   -- Current version number
├── content             JSONB NOT NULL               -- Structured SOW content (see 3.3)
│                                                    -- Validated at write time with Zod schema
├── total_estimated_hours NUMERIC(8,2)              -- Denormalized: SUM(content.phases[].estimatedHours)
│                                                    -- Recomputed on every content save
├── share_token         VARCHAR(64) UNIQUE           -- For client review link
├── share_enabled       BOOLEAN DEFAULT false
├── approved_at         TIMESTAMP                    -- Client approval timestamp
├── approved_by_name    TEXT                         -- Client approver name
├── approved_by_email   TEXT                         -- Client approver email
├── created_by          UUID NOT NULL (FK → users, ON DELETE RESTRICT)
├── created_at          TIMESTAMP
├── updated_at          TIMESTAMP
├── deleted_at          TIMESTAMP                    -- Soft delete
```

**Indexes:**
- `idx_sow_project (project_id) WHERE deleted_at IS NULL`
- `idx_sow_status (status) WHERE deleted_at IS NULL`
- `idx_sow_share_token (share_token) WHERE deleted_at IS NULL AND share_token IS NOT NULL AND share_enabled = true`
- `idx_sow_proposal (proposal_id) WHERE deleted_at IS NULL AND proposal_id IS NOT NULL`
- `idx_sow_created_by (created_by) WHERE deleted_at IS NULL`

**SOW statuses** (`sow_status` enum):

| Status               | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `DRAFT`              | Being authored. Editable.                                            |
| `IN_REVIEW`          | Sent to client for review.                                          |
| `REVISION_REQUESTED` | Client has requested changes. Returns to editable state with audit trail. |
| `APPROVED`           | Client has approved. Ready for task generation.                      |
| `IN_PROGRESS`        | Tasks have been generated; work is underway.                         |
| `COMPLETED`          | All phases delivered. **Manual transition** — admin marks SOW as completed when all linked tasks are done. Not auto-computed from task statuses (task status changes don't trigger SOW status changes). The SOW detail view shows task progress to inform the admin's decision. |
| `SUPERSEDED`         | Replaced by a newer SOW version.                                     |

### 3.3 SOW Content Structure

The `content` JSONB field follows a structured schema. These TypeScript interfaces live in `lib/scopes-of-work/types.ts`, with a corresponding Zod schema for runtime validation on writes (matching the proposal pattern in `lib/proposals/types.ts`):

```typescript
interface SOWContent {
  summary: string // Executive summary / project overview

  phases: SOWPhase[]

  risks: {
    title: string
    description: string
    mitigation?: string
  }[]

  assumptions: string[] // Key assumptions

  constraints: string[] // Known constraints

  outOfScope: string[] // Explicitly excluded items
}

interface SOWPhase {
  id: string // Stable identifier (nanoid or UUID) — used by sow_task_links
  index: number // Display ordering (1-based, for presentation only)
  title: string // e.g., "Discovery & Architecture"
  description: string // Phase purpose and approach
  estimatedHours: number // Hour estimate for the phase
  deliverables: SOWDeliverable[]
}

interface SOWDeliverable {
  title: string // e.g., "Database schema design"
  description?: string // Optional detail
  estimatedHours?: number // Per-deliverable estimate (optional)
}
```

**Stable phase IDs:** Each phase has an `id` field (generated via `nanoid()` on creation) that serves as the stable identifier for SOW-to-task linking. The `index` field is for display ordering only. This means reordering or removing phases in the JSONB array does not break task links — the `sow_task_links.phase_id` always references the stable `id`, not the array position.

**JSONB querying:** The main pattern is "fetch the SOW, read content in application code." There is no need for GIN indexes on the content field since queries do not use `WHERE content @> '...'`. The version dedup uses a content hash, not JSONB comparison.

**Proposal-to-SOW mapping:** When pre-populating a SOW from a linked proposal, a transformation utility (`lib/scopes-of-work/transform-from-proposal.ts`) maps `ProposalContent.phases` → `SOWContent.phases`. This is not a 1:1 copy — the schemas differ:
- `ProposalPhase.purpose` → `SOWPhase.description`
- `ProposalPhase.deliverables` (string array) → `SOWPhase.deliverables` (SOWDeliverable objects with `title` = string value, `description` = empty)
- `SOWPhase.id` — generated fresh via `nanoid()`
- `SOWPhase.estimatedHours` — initialized to `0` (not present on ProposalPhase, admin fills in manually)

### 3.4 SOW Location in the UI

SOWs live **inside projects**, accessible via a new tab in the project view:

```
/projects/[clientSlug]/[projectSlug]/
├── board/          (existing)
├── backlog/        (existing)
├── calendar/       (existing)
├── review/         (existing)
├── time-logs/      (existing)
├── scopes/         (NEW — list of SOWs for this project)
│   └── [sowId]/    (NEW — SOW detail/editor)
├── archive/        (existing)
└── activity/       (existing)
```

**Scopes tab:**

- Lists all SOWs for the project, ordered by creation date (newest first).
- Status badge on each SOW card.
- "New Scope of Work" button to create a new SOW.
- Can optionally pre-populate from the linked proposal's content (phases, deliverables, risks).

**SOW editor:**

- Rich form for editing the structured content.
- Phase builder: add/remove/reorder phases, each with deliverables and hour estimates.
- Running total of estimated hours across all phases.
- Preview mode showing the client-facing document.
- Share controls (generate link, optional password — reuse proposal sharing pattern).
- Approval status and client info.
- **Client approval is simple**: client clicks "Approve" on the shared page. We record their name, email, and timestamp. No signature capture (unlike proposals). **Security note:** The approval endpoint is unauthenticated (accessible via share token). Rate-limit the `POST /api/public/sow/[token]/approve` endpoint and validate that the SOW is in `IN_REVIEW` status before accepting approval. Only allow approval once (guard against replay).

### 3.5 SOW-to-Task Generation

When a SOW is approved, the admin can trigger task generation:

**One task per phase.** Each SOW phase generates a single task in the project backlog. Deliverables within the phase are listed in the task but don't create separate tasks.

**Link, don't copy.** Tasks do not duplicate SOW content into their description. Instead, tasks link to the SOW phase via `sow_task_links` and the task UI renders the linked phase content live from the SOW. This means:
- Editing a SOW phase automatically updates what the linked task displays — no sync mechanism needed.
- The task can have its own additional notes/description on top of the linked SOW content.
- No risk of SOW-task content drift.

**Generated task structure:**
- **Title**: Derived from the phase title (e.g., "Phase 1: Discovery & Architecture").
- **Estimated hours**: Populated from `SOWPhase.estimatedHours`.
- **Description**: Task's own description field is initially empty. The SOW phase content (description, deliverables, risks) is rendered in the task sheet via the link, not copied.
- **Status**: `BACKLOG` (tasks start in backlog awaiting prioritization).

**SOW editor shows task status.** When viewing a SOW that has generated tasks, each phase displays the linked task's current status (e.g., BACKLOG, IN_PROGRESS, DONE) so you can see project progress at the SOW level.

**Soft-deleted SOW handling:** If a SOW is soft-deleted, linked tasks remain active. The task sheet should query SOW content without filtering on `deletedAt` (or display a "SOW archived" placeholder) to preserve the phase content display. The task's own title and description fields serve as fallback.

**Detailed task PRDs** (e.g., implementation-ready specs per task) are deferred to a future phase. This PRD focuses on the SOW → task linkage and phase-level generation.

**Join table for SOW-task linkage:**

```
sow_task_links
├── id                  UUID PRIMARY KEY
├── sow_id              UUID NOT NULL (FK → scopes_of_work, ON DELETE CASCADE)
├── task_id             UUID NOT NULL (FK → tasks, ON DELETE CASCADE)
├── phase_id            VARCHAR(36) NOT NULL        -- Stable phase ID from SOWPhase.id in JSONB
├── created_at          TIMESTAMP
├── updated_at          TIMESTAMP
├── deleted_at          TIMESTAMP                   -- Soft delete (preserves history if task is unlinked)
├── UNIQUE(sow_id, task_id)
```

**Indexes:**
- `idx_sow_task_links_sow (sow_id)` — SOW detail page shows all linked tasks
- `idx_sow_task_links_task (task_id)` — Task sheet looks up its linked SOW phase

**Why `phase_id` instead of `phase_index`:** Referencing phases by array index would break links when phases are reordered or removed — indices shift, and tasks would silently point at the wrong phase. The stable `phase_id` (matching `SOWPhase.id` in the JSONB content) is decoupled from array position. If a phase is deleted from the SOW, orphaned links can be detected by checking whether `phase_id` still exists in the content.

**Soft delete on task-SOW link:** When a task is unlinked from a SOW phase (e.g., admin regenerates tasks after SOW revision), the link is soft-deleted to preserve the history of which tasks were originally generated from which phases.

### 3.6 SOW Iteration

When a client wants to continue iterating on a project:

1. Admin creates a new SOW within the same project (e.g., "Phase 2: Feature Expansion").
2. The new SOW may reference the previous one but is an independent document.
3. Task generation works the same way — new tasks are created in the backlog.
4. Previous SOWs move to `COMPLETED` or remain `IN_PROGRESS` based on task status.

---

## 4. SOW Version History

### 4.1 Motivation

SOWs go through iterative refinement before client approval. Version history lets you track how the scope evolved, compare drafts, and restore previous versions if needed.

Version history is scoped to SOWs only for this PRD. Extending to tasks, proposals, or other entities is a future consideration.

### 4.2 SOW Versions Table

```
sow_versions
├── id                  UUID PRIMARY KEY
├── sow_id              UUID NOT NULL (FK → scopes_of_work, ON DELETE CASCADE)
├── version_number      INTEGER NOT NULL
├── content             JSONB NOT NULL              -- Snapshot of SOW content at this version
├── content_hash        VARCHAR(64) NOT NULL        -- SHA-256 of canonical JSON for dedup
│                                                    -- IMPORTANT: Use a deterministic serializer with
│                                                    -- deeply sorted keys. Do NOT rely on plain
│                                                    -- JSON.stringify() or on patterns like
│                                                    -- JSON.stringify(content, Object.keys(content).sort())
│                                                    -- which only apply top-level keys and drop nested ones.
│                                                    -- Instead, use a helper that deeply sorts object keys
│                                                    -- (e.g. canonicalize(content)) or a dedicated
│                                                    -- canonical-JSON / stable-stringify library.
├── change_summary      TEXT                        -- Optional human-readable summary
├── created_by          UUID NOT NULL (FK → users, ON DELETE RESTRICT)
├── created_at          TIMESTAMP NOT NULL
├── updated_at          TIMESTAMP                   -- Schema consistency (rarely used on immutable records)
├── deleted_at          TIMESTAMP                   -- Schema consistency (versions are append-only, but
│                                                   -- soft delete supports admin cleanup of test data)
├── UNIQUE(sow_id, version_number)
```

**Indexes:**
- `idx_sow_versions_sow (sow_id, version_number DESC)` — Version history query, ordered by version
- `idx_sow_versions_dedup (sow_id, content_hash)` — Dedup check before creating new version

**How it works:**

- The `scopes_of_work.version` field tracks the current version number.
- A new version row is created when:
  - The admin explicitly clicks "Save Version".
  - A status transition occurs (e.g., DRAFT → IN_REVIEW).
  - Content hash differs from the last version (avoids duplicate snapshots).
- Viewing history: query `sow_versions` ordered by `version_number DESC`.
- Restoring: copy a previous version's content back to the SOW and increment the version number (never destructive).

### 4.3 Version History UI

- Accessible via a "History" button in the SOW editor.
- Shows a timeline of versions with timestamps, authors, and change summaries.
- "Restore this version" action creates a new version with the old content.

---

## 5. Data Model Summary

### 5.1 New Tables

| Table                | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `invoices`           | Invoice header with status, totals, share link, Stripe references      |
| `invoice_line_items` | Individual charges on an invoice (hours, custom line items)            |
| `billing_settings`   | Global billing configuration singleton (hourly rate, company info)     |
| `scopes_of_work`     | Scope documents tied to projects                                       |
| `sow_task_links`     | Maps SOW phases to generated tasks via stable phase_id (link, not copy)|
| `sow_versions`       | Version history snapshots for SOW content with content_hash dedup      |

### 5.2 Modified Tables

| Table         | Changes                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `tasks`       | Add `estimated_hours` NUMERIC(8,2) for SOW-derived estimates (nullable, safe migration)                      |

**Note:** `hour_blocks` is NOT modified in this migration. Hour block → invoice linkage is navigated through `invoice_line_items.hour_block_id` → `invoice_line_items.invoice_id`, avoiding a bidirectional FK sync concern.

**Legacy field:** `hour_blocks.invoiceNumber` (TEXT) currently stores manually-entered invoice numbers from the QuickBooks era. This field becomes redundant once invoices are managed in the portal — new hour blocks created via `markInvoicePaid()` will have their invoice linkage via `invoice_line_items.hour_block_id` instead. The column is NOT dropped (existing data is preserved), but new code should not write to it. Consider deprecation in a future cleanup migration.

### 5.3 New Enums

| Enum             | Values                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `invoice_status` | `DRAFT`, `SENT`, `VIEWED`, `PAID`, `PARTIALLY_PAID`, `REFUNDED`, `VOID`                      |
| `line_item_type` | `HOURS_PREPAID`, `HOURS_WORKED`, `CUSTOM`                                                     |
| `sow_status`     | `DRAFT`, `IN_REVIEW`, `REVISION_REQUESTED`, `APPROVED`, `IN_PROGRESS`, `COMPLETED`, `SUPERSEDED` |

**Note:** `OVERDUE` is a computed state derived from `due_date < NOW()`, not a stored enum value (see Section 2.2).

### 5.4 Relations (`lib/db/relations.ts`)

All new relations to define:

| From               | To                   | Type      | FK / Via                        |
| ------------------- | -------------------- | --------- | ------------------------------- |
| `clients`           | `invoices`           | one-many  | `invoices.client_id`            |
| `invoices`          | `invoice_line_items` | one-many  | `line_items.invoice_id`         |
| `invoice_line_items`| `hour_blocks`        | one-one?  | `line_items.hour_block_id`      |
| `users`             | `invoices`           | one-many  | `invoices.created_by`           |
| `users`             | `billing_settings`   | one-one   | `billing_settings.updated_by`   |
| `projects`          | `scopes_of_work`     | one-many  | `sow.project_id`                |
| `proposals`         | `scopes_of_work`     | one-many  | `sow.proposal_id` (optional)    |
| `scopes_of_work`    | `sow_task_links`     | one-many  | `links.sow_id`                  |
| `tasks`             | `sow_task_links`     | one-many  | `links.task_id`                 |
| `scopes_of_work`    | `sow_versions`       | one-many  | `versions.sow_id`               |
| `users`             | `scopes_of_work`     | one-many  | `sow.created_by`                |
| `users`             | `sow_versions`       | one-many  | `versions.created_by`           |

### 5.5 ON DELETE Behaviors

| FK Column                          | ON DELETE     | Rationale                                             |
| ---------------------------------- | ------------- | ----------------------------------------------------- |
| `invoices.client_id`               | RESTRICT      | Never cascade-delete financial records                |
| `invoices.created_by`              | RESTRICT      | Preserve audit trail                                  |
| `invoice_line_items.invoice_id`    | CASCADE       | Line items are owned by their invoice                 |
| `invoice_line_items.hour_block_id` | SET NULL      | Hour block removal should not destroy line item       |
| `scopes_of_work.project_id`       | CASCADE       | SOWs are owned by their project                       |
| `scopes_of_work.proposal_id`      | SET NULL      | Proposal removal should not destroy SOW               |
| `scopes_of_work.created_by`       | RESTRICT      | Preserve audit trail                                  |
| `sow_task_links.sow_id`           | CASCADE       | Links are owned by their SOW                          |
| `sow_task_links.task_id`           | CASCADE       | Links are owned by their task                         |
| `sow_versions.sow_id`             | CASCADE       | Versions are owned by their SOW                       |
| `sow_versions.created_by`         | RESTRICT      | Preserve audit trail                                  |
| `billing_settings.updated_by`     | SET NULL      | Settings survive user removal                         |

**Existing inconsistency (future cleanup):** `hour_blocks.clientId` currently uses `ON DELETE CASCADE`, which would cascade-delete financial hour block records if a client is deleted. This conflicts with the RESTRICT philosophy for financial data. Consider migrating to `ON DELETE RESTRICT` in a future cleanup (aligns with `invoices.client_id` behavior). Not addressed in this PRD since the `hour_blocks` table is not being modified.

### 5.6 Entity Relationship Overview

```
clients ─────────┬──── invoices ──── invoice_line_items ──── hour_blocks
                  │                   (line_items.hour_block_id navigates
                  │                    to the hour block purchased by
                  │                    this line item)
                  │
                  └──── projects ──── scopes_of_work ──── sow_task_links ──── tasks
                                          │                (link via stable phase_id —
                                          │                 tasks read SOW phase
                                          │                 content live)
                                          └──── sow_versions
```

---

## 6. Integration Architecture

### 6.1 Shared Sharing Infrastructure

The share token pattern (token generation, validation, public page routing) is used by proposals, invoices, and SOWs. Extract into a shared module to prevent implementation drift:

```
lib/sharing/
  tokens.ts          -- generateShareToken() (32-char hex), TOKEN_REGEX (/^[a-f0-9]{32,64}$/),
                     -- validateToken(). Note: proposals also use generateCountersignToken()
                     -- (64-char hex via randomBytes) — regex must accommodate both lengths.
  password.ts        -- hashSharePassword(), verifySharePassword() (wrapping bcryptjs)
  view-tracking.ts   -- recordView() generic helper for tracking first-view timestamps
  types.ts           -- ShareableEntity interface
```

This builds on the existing implementation in `lib/data/proposals.ts` (`generateShareToken()`, `generateCountersignToken()`, and bcryptjs password hashing). **Note:** `lib/auth/crypto.ts` contains HMAC signing/verification only (not password hashing). The bcryptjs-based `hashSharePassword()` / `verifySharePassword()` should be extracted from `lib/data/proposals.ts` into `lib/sharing/password.ts`.

### 6.2 Stripe Payment Integration

```typescript
// lib/integrations/stripe/client.ts
// Stripe SDK initialization (lazy singleton, uses STRIPE_SECRET_KEY env var)

// lib/integrations/stripe/payment-intents.ts
createPaymentIntent(invoiceId: string, amount: number, currency: string): Promise<PaymentIntent>
getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent>

// lib/integrations/stripe/webhooks.ts
handleWebhookEvent(event: Stripe.Event): Promise<void>
verifySignature(body: string, signature: string): Stripe.Event
// Handles: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
```

**Webhook endpoint:** `POST /api/integrations/stripe/webhook`
- Validates Stripe webhook signature (`STRIPE_WEBHOOK_SECRET` env var).
- On `payment_intent.succeeded`: calls `markInvoicePaid()` — idempotent, transaction-wrapped (see Section 2.6).
- On `payment_intent.payment_failed`: logs the failure for admin visibility.
- On `charge.refunded`: marks invoice `REFUNDED`, logs activity.

**Polling fallback:** Manual "Check Payment Status" button on the invoice detail page queries Stripe's PaymentIntent API directly and calls the same `markInvoicePaid()` function.

### 6.3 Invoice Number Generation

Invoice numbers follow the format `INV-2026-0001` and must be unique and monotonically increasing under concurrent creation. Small gaps in the sequence (due to rollbacks or failed transactions) are acceptable.

**Approach:** PostgreSQL SEQUENCE for atomic, unique, monotonic numbering:

```sql
CREATE SEQUENCE invoice_number_seq START WITH 1;
```

Application code generates the number on DRAFT → SENT transition:

```typescript
const [{ nextVal }] = await db.execute(sql`SELECT nextval('invoice_number_seq')`)
const invoiceNumber = `${prefix}-${year}-${String(nextVal).padStart(4, '0')}`
```

The UNIQUE constraint on `invoice_number` provides a safety net. Draft invoices have `NULL` invoice_number until they are first sent.

**Year rollover:** The SEQUENCE is global (not per-year), so numbers will be continuous across years (e.g., `INV-2026-0042`, then `INV-2027-0043`). This is intentional — it ensures uniqueness without needing to reset the sequence annually. The year in the invoice number indicates when it was sent, not a per-year counter. If per-year reset is desired later, either: (a) create a new SEQUENCE per year programmatically, or (b) track the last-used number per year in `billing_settings`.

### 6.4 Public Routes

All public-facing pages live under the existing `app/(public)/` route group, reusing the branded layout (logo header, centered content). **Note:** `noindex`/`nofollow` meta should be set per-page via Next.js `metadata` export (not in `layout.tsx`), since future public pages may intentionally be indexable:

```
app/(public)/
  layout.tsx                    -- Existing branded layout
  p/[token]/                    -- Existing proposal public pages
  invoice/[shareToken]/         -- NEW: Public invoice page
  │  ├── Renders: company branding, line items, totals
  │  ├── Tracks: viewed_at on first visit
  │  ├── Embeds: Stripe Elements payment form (requires client-side JS)
  │  └── On payment: creates PaymentIntent, Stripe handles the rest via webhook
  sow/[shareToken]/             -- NEW: Public SOW page
     ├── Renders: SOW content (phases, deliverables, estimates)
     └── Approval button: captures name, email, timestamp
```

**API routes for public pages:**
- `GET /api/public/invoices/[token]` — Fetch invoice data for rendering
- `POST /api/public/invoices/[token]/pay` — Create Stripe PaymentIntent
- `GET /api/public/sow/[token]` — Fetch SOW data for rendering
- `POST /api/public/sow/[token]/approve` — Record SOW approval

### 6.5 Cron Job Architecture

```
GET /api/cron/monthly-invoices
├── Auth: Vercel Cron secret (CRON_SECRET env var, Bearer token — matches existing gmail-sync pattern)
├── NOTE: Vercel Cron sends GET requests (not POST). Matches the existing gmail-sync cron pattern.
├── Schedule: "0 10 1 * *" (1st of month, 10:00 UTC / 6:00 AM ET)
├── Steps:
│   ├── 1. Query all active clients with billing_type = 'net_30'
│   │      └── For each: check for existing draft invoice for same period (dedup)
│   │      └── Sum time_logs per project for previous month (timezone-aware: America/Los_Angeles)
│   │      └── Generate draft invoice with one HOURS_WORKED line item per project
│   ├── 2. Log results to activity system
│   └── 3. Return structured results: { generated, skipped, errors[] }
│          Admin reviews drafts in /invoices, adds custom line items, then enables sharing
```

**Note:** Prepaid invoices are not auto-generated. They are created manually when a client requests more hours.

### 6.6 Email Notifications

Invoice link delivery uses **Resend** (consistent with proposal notifications):

- **Client invoice link**: Sent via Resend when admin enables sharing and clicks "Send". Email contains the share link URL and invoice summary. Include both HTML and plain text versions (Resend supports `text` parameter alongside `html`).
- **Admin notifications**: In-app alerts for payment confirmation, overdue invoices. Optional email via Resend for payment received events.

### 6.7 Activity System Integration

New target types and verb constants for the activity system:

**New target types** (add to `ActivityTargetType` in `lib/activity/types.ts`):
- `INVOICE`
- `SOW`

**New event files:**

Following the existing pattern in `lib/activity/events/proposals.ts`, event functions are **pure factory functions** that return `ActivityEvent` objects. The caller passes the result to `logActivity()`. They do NOT self-log.

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

---

## 7. Permissions & Access Control

| Action                            | Admin     | Client User                 |
| --------------------------------- | --------- | --------------------------- |
| View invoices (admin UI)          | Yes (all) | No                          |
| Create / edit invoices            | Yes       | No                          |
| View & pay invoice (share link)   | N/A       | Yes (via public share link)  |
| Mark invoices paid manually       | Yes       | No                          |
| View SOWs for their project       | Yes (all) | Yes (own client's projects) |
| Create / edit SOWs                | Yes       | No                          |
| Approve SOWs (client-facing link) | N/A       | Yes (via share link)        |
| View SOW version history          | Yes       | No                          |
| Generate tasks from SOW           | Yes       | No                          |

---

## 8. Implementation Strategy

### Phase 1 — Invoice Foundation + Stripe (Replaces Hour Blocks Screen)

1. **Shared utilities**: Extract `lib/sharing/` module from proposal code (token generation, validation, password protection). This is used by invoices, SOWs, and proposals.
2. **Schema**: Create `invoice_status` and `line_item_type` enums. Create `invoices`, `invoice_line_items`, and `billing_settings` tables with all indexes and constraints. Create `invoice_number_seq` PostgreSQL SEQUENCE. Seed billing_settings singleton row.
3. **Stripe integration**: `lib/integrations/stripe/` — SDK client, PaymentIntent creation/retrieval, webhook handler with idempotency. Webhook endpoint (`POST /api/integrations/stripe/webhook`) with signature verification. Shared `markInvoicePaid()` transactional function.
4. **Queries & Data Layer**: `lib/queries/invoices.ts`, `lib/queries/billing-settings.ts`, `lib/data/invoices/`. CRUD operations for invoices and line items. Invoice immutability enforcement for PAID/VOID/REFUNDED. Billing settings singleton read/write with `cache()`. **New time log query required:** `fetchTimeLogSummaryByProjectForClient(clientId, periodStart, periodEnd)` — aggregates hours per project for a client within a date range. This query does not currently exist in `lib/queries/time-logs.ts` and must be created for the monthly cron.
5. **Activity events**: `lib/activity/events/invoices.ts` with all invoice lifecycle events. Add `INVOICE` target type.
6. **Invoice admin UI**: `/invoices` in the Sales sidebar section (replaces Hour Blocks). List view, detail/editor sheet, create flow with prepaid defaults (5-hour pre-fill, preset buttons). Include "Duplicate invoice" action. Invoice settings tab for hourly rate and company info.
7. **Public invoice page**: `app/(public)/invoice/[shareToken]/` — branded invoice page with embedded Stripe Elements payment form. Uses shared sharing infrastructure.
8. **Email notifications**: Invoice link delivery via Resend (consistent with proposal pattern).
9. **Hour block auto-creation**: On Stripe `payment_intent.succeeded`, `markInvoicePaid()` automatically creates corresponding `hour_block` record for prepaid invoices within the same transaction. Links via `invoice_line_items.hour_block_id`.
10. **Legacy data**: Ensure existing hour block records remain accessible via client detail page.

### Phase 2 — Monthly Cron + Dashboard

1. **Vercel Cron**: Monthly invoice generation endpoint (`GET /api/cron/monthly-invoices` — Vercel Cron sends GET). Net-30 clients only — one `HOURS_WORKED` line item per project at the global hourly rate. Duplicate detection (skip if draft exists for same period). Timezone-aware date boundaries (`America/Los_Angeles`). Structured results. Manual "Generate Now" fallback button.
2. **Dashboard widgets**: Outstanding invoice count. Monthly revenue summary. Overdue alerts (computed from `due_date`, not stored status).

### Phase 3 — Scopes of Work + Version History

1. **Schema**: Create `sow_status` enum. Create `scopes_of_work`, `sow_task_links`, and `sow_versions` tables with all indexes and constraints. Add `estimated_hours` NUMERIC(8,2) to `tasks` (nullable, safe migration).
2. **SOW types**: `lib/scopes-of-work/types.ts` — TypeScript interfaces + Zod schemas for `SOWContent`, `SOWPhase` (with stable `id` field), `SOWDeliverable`. `lib/scopes-of-work/transform-from-proposal.ts` for proposal→SOW content mapping.
3. **SOW editor UI**: Structured phase/deliverable builder with auto-generated `nanoid()` for each phase. Hour estimate calculator. Preview mode and share controls.
4. **Project integration**: New "Scopes" tab in project view. SOW list and detail pages.
5. **Client approval flow**: Share link generation via shared `lib/sharing/` module. Public page at `app/(public)/sow/[shareToken]/`. Simple button approval — client clicks "Approve", we record name, email, timestamp. No signature capture. `REVISION_REQUESTED` status for client feedback.
6. **Proposal-to-SOW**: Optional pre-population of SOW content from linked proposal phases via transformation utility.
7. **Version history**: SOW version snapshots on save and status transitions. `content_hash` dedup (NOT NULL, SHA-256 of canonical JSON — deterministic key ordering, not `JSON.stringify()`). History panel with timeline and restore action.
8. **Activity events**: `lib/activity/events/scopes-of-work.ts` with all SOW lifecycle events. Add `SOW` target type.

### Phase 4 — SOW-to-Task Generation

1. **Task generation engine**: Convert approved SOW phases into backlog tasks (one task per phase). Link via `sow_task_links` using stable `phase_id` — tasks read SOW phase content live, no content duplication.
2. **Task sheet integration**: Task sheet renders linked SOW phase content (description, deliverables, estimated hours) alongside the task's own description. Estimated hours propagated to task. Handles soft-deleted SOWs gracefully (fallback to task's own content).
3. **SOW-task status sync**: SOW detail view shows generated tasks and their statuses. Visual indicator of phase completion based on linked task statuses. Editing a SOW phase is immediately reflected in the linked task view.

### Migration Ordering

Migrations must be applied in dependency order:

```
--- Phase 1 migrations (invoice foundation) ---
1. Create enums: invoice_status, line_item_type
2. Create billing_settings table (with singleton CHECK constraint + seed row)
3. Create invoice_number_seq SEQUENCE
4. Create invoices table (with all indexes)
5. Create invoice_line_items table (with soft delete, CHECK constraints, indexes)

--- Phase 3 migrations (scopes of work) ---
6. Create enum: sow_status
7. Create scopes_of_work table (with all indexes)
8. Create sow_task_links table (with soft delete, indexes)
9. Create sow_versions table (with NOT NULL content_hash, indexes)
10. Alter tasks: ADD estimated_hours NUMERIC(8,2)
```

**Note:** Each phase's migrations should be generated and applied together. Phase 3 migrations can safely run independently of Phase 1 (no cross-dependencies between the invoice and SOW tables).

All column additions to existing tables are nullable → safe, non-breaking, no downtime.

### Recommended File Structure

```
# === SHARED UTILITIES ===
lib/sharing/
  tokens.ts                                         # generateShareToken(), TOKEN_REGEX, validateToken()
  password.ts                                       # hashSharePassword(), verifySharePassword()
  view-tracking.ts                                  # recordView() generic helper
  types.ts                                          # ShareableEntity interface

# === STRIPE INTEGRATION ===
lib/integrations/stripe/
  client.ts                                         # Stripe SDK initialization (lazy singleton)
  payment-intents.ts                                # createPaymentIntent(), getPaymentIntent()
  webhooks.ts                                       # handleWebhookEvent(), verifySignature()

# === INVOICE DOMAIN ===
lib/queries/invoices.ts                             # Invoice CRUD, line items, share token lookup
lib/queries/billing-settings.ts                     # Billing settings read/write
lib/data/invoices/
  index.ts                                          # Invoice business logic (create, send, void)
  sharing.ts                                        # Enable/disable sharing, view tracking
  monthly-generation.ts                             # Net-30 cron logic (extracted for testability)
  mark-paid.ts                                      # Shared idempotent payment handler (transaction)
lib/invoices/
  types.ts                                          # Invoice types, line item types
  constants.ts                                      # Status labels, number formatting
  number-generator.ts                               # Invoice number generation with PG sequence
lib/billing/
  constants.ts                                      # BILLING_SETTINGS_ID sentinel UUID

# === SOW DOMAIN ===
lib/queries/scopes-of-work.ts                       # SOW CRUD, version queries
lib/queries/sow-task-links.ts                       # Link table operations
lib/data/scopes-of-work/
  index.ts                                          # SOW business logic (create, share, approve)
  sharing.ts                                        # Share token management
  task-generation.ts                                # Phase-to-task generation logic
  version-history.ts                                # Version snapshot creation, restore
lib/scopes-of-work/
  types.ts                                          # SOWContent, SOWPhase, SOWDeliverable + Zod schemas
  transform-from-proposal.ts                        # Proposal content → SOW content mapping

# === BILLING SETTINGS ===
lib/data/billing-settings.ts                        # Cached singleton read, admin update

# === ACTIVITY EVENTS ===
lib/activity/events/invoices.ts                     # Invoice activity event helpers
lib/activity/events/scopes-of-work.ts               # SOW activity event helpers

# === API ROUTES ===
app/api/integrations/stripe/webhook/route.ts        # Stripe webhook endpoint
app/api/cron/monthly-invoices/route.ts              # Vercel Cron monthly invoice generation
app/api/public/invoices/[token]/route.ts            # Public invoice data (GET)
app/api/public/invoices/[token]/pay/route.ts        # Create Stripe PaymentIntent (POST)
app/api/public/sow/[token]/route.ts                 # Public SOW data (GET)
app/api/public/sow/[token]/approve/route.ts         # SOW approval (POST)

# === DASHBOARD ROUTES ===
app/(dashboard)/invoices/
  page.tsx                                          # Invoice list (replaces hour-blocks)
  _components/                                      # Invoice table, detail sheet, create form
  _actions/                                         # Server actions (create, update, send, void, duplicate)
  settings/
    page.tsx                                        # Billing settings (hourly rate, company info)
    _actions/                                       # Settings update actions

app/(dashboard)/projects/[clientSlug]/[projectSlug]/scopes/
  page.tsx                                          # SOW list for project
  [sowId]/
    page.tsx                                        # SOW editor/detail
  _components/                                      # SOW editor, phase builder, version history
  _actions/                                         # SOW CRUD, approve, generate tasks

# === PUBLIC ROUTES ===
app/(public)/invoice/[shareToken]/
  page.tsx                                          # Public invoice page (server component)
  invoice-client.tsx                                # Client component with Stripe Elements
  payment-form.tsx                                  # Stripe Elements payment form

app/(public)/sow/[shareToken]/
  page.tsx                                          # Public SOW page
  approval-flow.tsx                                 # Approval button + name/email capture
```

---

## 9. Observability & Analytics

Track the following events in PostHog:

| Event                        | Properties                                           |
| ---------------------------- | ---------------------------------------------------- |
| `invoice_created`            | `billing_type`, `total`, `line_item_count`           |
| `invoice_sent`               | `invoice_id`, `client_id`                            |
| `invoice_paid`               | `invoice_id`, `days_to_payment`, `payment_method`    |
| `invoice_refunded`           | `invoice_id`, `client_id`                            |
| `invoice_voided`             | `invoice_id`, `client_id`                            |
| `monthly_invoices_generated` | `count`, `total_value`                               |
| `sow_created`                | `project_id`, `phase_count`, `total_estimated_hours` |
| `sow_sent_for_review`        | `sow_id`, `project_id`                               |
| `sow_approved`               | `sow_id`, `days_to_approval`                         |
| `sow_revision_requested`     | `sow_id`, `project_id`                               |
| `sow_tasks_generated`        | `sow_id`, `task_count`                               |
| `sow_version_created`        | `sow_id`, `version_number`                           |
| `sow_version_restored`       | `sow_id`, `from_version`, `to_version`               |

---

## 10. Risks & Mitigations

| Risk                          | Impact                                                | Mitigation                                                                                     |
| ----------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Stripe webhook reliability**| Missed webhooks = missed payment confirmations        | Validate webhook signatures. Idempotent `markInvoicePaid()` handler. Manual "Check Payment" polling fallback. Log all webhook events. |
| **Stripe webhook duplicates** | Duplicate events = duplicate hour block creation      | Idempotency check: return early if invoice is already PAID. Transaction wraps status + hour block creation atomically. |
| **Invoice number concurrency**| Concurrent creation = duplicate invoice numbers       | PostgreSQL SEQUENCE for atomic numbering. UNIQUE constraint as safety net. Number assigned on DRAFT→SENT transition. |
| **Public invoice security**   | Share links must not be guessable                     | Use cryptographically random tokens via shared `lib/sharing/` module (same as proposals). Rate-limit the public route. |
| **Cron reliability**          | Missed monthly runs = missed net-30 invoices          | Add monitoring/alerting on cron execution. Manual "Generate Now" fallback button. Duplicate detection prevents double-creation. |
| **Cron duplicate runs**       | Multiple runs in same month = duplicate draft invoices | Dedup check: skip if draft invoice exists for same client + billing period. |
| **SOW version storage**       | JSONB snapshots accumulate over time                  | Content hash dedup (NOT NULL SHA-256) prevents identical versions. Consider retention policy for old versions. |
| **Payment disputes**          | Client disputes Stripe charge                        | Stripe handles disputes. Portal marks invoice status accordingly via webhook (`charge.refunded` → `REFUNDED`). |
| **SOW phase deletion**        | Deleting a phase from SOW content orphans task links  | Stable `phase_id` in sow_task_links. Orphaned links detectable by checking if phase_id exists in content. UI shows warning. |
| **Soft-deleted SOW display**  | Task sheet can't render archived SOW phase content    | Query SOW content without `deletedAt` filter for task rendering, or show "SOW archived" placeholder. |

---

## 11. Resolved Decisions

| Question | Decision |
|----------|----------|
| Billing provider | Stripe (not QuickBooks). Stripe is payment processor; portal owns the invoice UI. |
| Invoice delivery | Public-facing invoice page with share link (like proposals). Fully branded. |
| Payment method | Embedded Stripe Elements on the public invoice page. |
| Invoice numbering | PostgreSQL SEQUENCE for atomic auto-increment (INV-YYYY-NNNN). Number assigned on DRAFT→SENT. |
| Net-30 line item granularity | One line item per project |
| Prepaid auto-generation | Manual only — cron handles net-30 only |
| Invoice sidebar placement | Sales section (replaces Hour Blocks item) |
| Hourly rates | Single global rate ($200/hr), configurable via `/invoices/settings`. Per-client rates deferred (schema supports future COALESCE pattern). |
| Client invoice visibility | Clients view/pay via public share link. No in-portal invoice view for clients. |
| OVERDUE status | Computed state from `due_date < NOW()`, not stored enum. Avoids stale status. |
| Hour block ↔ invoice linkage | Navigate via `invoice_line_items.hour_block_id` → `invoice_line_items.invoice_id`. No bidirectional FK on hour_blocks. |
| SOW phase identification | Stable `phase_id` (nanoid) in JSONB, not array index. Prevents link breakage on reorder/delete. |
| SOW approval mechanism | Simple button approval (name, email, timestamp — no signature). `REVISION_REQUESTED` status for client feedback. |
| Task generation granularity | One task per phase |
| SOW-task content sync | Link via stable `phase_id`, don't copy — tasks read SOW phase content live |
| Task PRD format | Deferred to future phase |
| Version control scope | SOW versioning only (dedicated `sow_versions` table with NOT NULL content_hash for dedup) |
| Cron provider | Vercel Cron with duplicate detection |
| SOW templates | Not needed — build from scratch or pre-populate from proposal |
| Sharing infrastructure | Shared `lib/sharing/` module extracted from proposals. Used by invoices, SOWs, and proposals. |
| Public page routing | All public pages under `app/(public)/` route group for consistent branded layout. |
| Webhook idempotency | Shared `markInvoicePaid()` function with early return for already-paid invoices. Transaction-wrapped. |
| Email notifications | Resend for client-facing invoice emails (consistent with proposal pattern). |
| billing_settings singleton | CHECK constraint locks PK to sentinel UUID. UPSERT for writes. Seeded in migration. |
| Soft delete consistency | All new tables include `deleted_at`. Line items, task links, and versions included for project-wide consistency. |

---

## 12. Dependencies

- **PRD 007** (Clients & CRM): Client data model, billing type field, client detail pages.
- **PRD 008** (OAuth & Email): Proposal system, Gmail integration, sharing infrastructure (share tokens, public pages — to be extracted into shared `lib/sharing/` module).
- **Stripe Account**: Existing account. Needs API keys (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) and webhook secret (`STRIPE_WEBHOOK_SECRET`) configured in environment. The publishable key requires the `NEXT_PUBLIC_` prefix since it's used in the client-side Stripe Elements component on the public invoice page.
- **Vercel Cron**: For monthly net-30 invoice generation scheduling (configure in `vercel.json`, matches existing gmail-sync cron pattern with `CRON_SECRET` Bearer auth). **Note:** The project already has 2 crons (`gmail-sync`, `email-scheduled`). Vercel Hobby allows 2 cron jobs; adding a 3rd requires the **Pro plan** (up to 40 crons). Verify the current Vercel plan before implementation.
- **Resend**: For client-facing invoice email delivery (existing integration in `lib/email/resend.ts`).
- **nanoid**: For generating stable SOW phase IDs (or use `crypto.randomUUID()`).
