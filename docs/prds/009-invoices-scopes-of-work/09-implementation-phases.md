# 09: Implementation Phases

> Part of [PRD 009: Invoices & Scopes of Work](./README.md)
> See [TASKS.md](./TASKS.md) for granular task tracking

## Phase 1 — Invoice Foundation + Stripe (Replaces Hour Blocks Screen)

1. **Shared utilities**: Extract `lib/sharing/` module from proposal code (token generation, validation, password protection).
2. **Schema**: Create `invoice_status` and `line_item_type` enums. Create `invoices`, `invoice_line_items`, and `billing_settings` tables with all indexes and constraints. Create `invoice_number_seq` SEQUENCE. Seed `billing_settings` singleton.
3. **Stripe integration**: `lib/integrations/stripe/` — SDK client, PaymentIntent creation/retrieval, webhook handler with idempotency. Webhook endpoint with signature verification. Shared `markInvoicePaid()` transactional function.
4. **Queries & Data Layer**: `lib/queries/invoices.ts`, `lib/queries/billing-settings.ts`, `lib/data/invoices/`. CRUD operations. Immutability enforcement for PAID/VOID/REFUNDED. Billing settings singleton with `cache()`. **New query:** `fetchTimeLogSummaryByProjectForClient(clientId, periodStart, periodEnd)`.
5. **Activity events**: `lib/activity/events/invoices.ts`. Add `INVOICE` target type.
6. **Invoice admin UI**: `/invoices` in Sales sidebar (replaces Hour Blocks). List, detail/editor, create flow with prepaid defaults. "Duplicate invoice" action. Settings tab.
7. **Public invoice page**: `app/(public)/invoice/[shareToken]/` — branded page with Stripe Elements.
8. **Email notifications**: Invoice link delivery via Resend.
9. **Hour block auto-creation**: `markInvoicePaid()` creates `hour_block` for prepaid invoices within the same transaction.
10. **Legacy data**: Existing hour block records remain accessible.

## Phase 2 — Monthly Cron + Dashboard

1. **Vercel Cron**: `GET /api/cron/monthly-invoices`. Net-30 only, one `HOURS_WORKED` line item per project. Duplicate detection. Timezone-aware boundaries. Manual "Generate Now" fallback.
2. **Dashboard widgets**: Outstanding invoice count. Monthly revenue summary. Overdue alerts (computed).

## Phase 3 — Scopes of Work + Version History

1. **Schema**: Create `sow_status` enum. Create `scopes_of_work`, `sow_task_links`, `sow_versions` tables. Add `estimated_hours` to `tasks`.
2. **SOW types**: `lib/scopes-of-work/types.ts` — interfaces + Zod schemas. `transform-from-proposal.ts` for proposal→SOW mapping.
3. **SOW editor UI**: Phase/deliverable builder with `nanoid()` IDs. Hour estimate calculator. Preview mode and share controls.
4. **Project integration**: "Scopes" tab in project view. SOW list and detail pages.
5. **Client approval flow**: Share link via `lib/sharing/`. Public page at `app/(public)/sow/[shareToken]/`. Button approval with name, email, timestamp.
6. **Proposal-to-SOW**: Optional pre-population from linked proposal.
7. **Version history**: Snapshots on save and status transitions. `content_hash` dedup. History panel with timeline and restore.
8. **Activity events**: `lib/activity/events/scopes-of-work.ts`. Add `SOW` target type.

## Phase 4 — SOW-to-Task Generation

1. **Task generation engine**: Convert approved SOW phases into backlog tasks (one per phase). Link via `sow_task_links` with stable `phase_id`.
2. **Task sheet integration**: Render linked SOW phase content alongside task's own description. Estimated hours propagated. Handles soft-deleted SOWs.
3. **SOW-task status sync**: SOW detail view shows generated tasks and statuses. Phase completion indicator.

## Migration Ordering

Migrations must be applied in dependency order:

```
--- Phase 1 migrations (invoice foundation) ---
1. Create enums: invoice_status, line_item_type
2. Create billing_settings table (CHECK constraint + seed row)
3. Create invoice_number_seq SEQUENCE
4. Create invoices table (all indexes)
5. Create invoice_line_items table (soft delete, CHECK constraints, indexes)

--- Phase 3 migrations (scopes of work) ---
6. Create enum: sow_status
7. Create scopes_of_work table (all indexes)
8. Create sow_task_links table (soft delete, indexes)
9. Create sow_versions table (NOT NULL content_hash, indexes)
10. Alter tasks: ADD estimated_hours NUMERIC(8,2)
```

**Phase 1 and Phase 3 migrations are independent** — no cross-table FKs. Can run in any order.

All column additions to existing tables are nullable → safe, non-breaking, no downtime.

## Recommended File Structure

```
# === SHARED UTILITIES ===
lib/sharing/
  tokens.ts                    # generateShareToken(), TOKEN_REGEX, validateToken()
  password.ts                  # hashSharePassword(), verifySharePassword()
  view-tracking.ts             # recordView() generic helper
  types.ts                     # ShareableEntity interface

# === STRIPE INTEGRATION ===
lib/integrations/stripe/
  client.ts                    # Stripe SDK initialization (lazy singleton)
  payment-intents.ts           # createPaymentIntent(), getPaymentIntent()
  webhooks.ts                  # handleWebhookEvent(), verifySignature()

# === INVOICE DOMAIN ===
lib/queries/invoices.ts
lib/queries/billing-settings.ts
lib/data/invoices/
  index.ts                     # Invoice business logic
  sharing.ts                   # Enable/disable sharing, view tracking
  monthly-generation.ts        # Net-30 cron logic
  mark-paid.ts                 # Idempotent payment handler (transaction)
lib/invoices/
  types.ts                     # Invoice types, line item types
  constants.ts                 # Status labels, number formatting
  number-generator.ts          # PG sequence number generation
lib/billing/
  constants.ts                 # BILLING_SETTINGS_ID sentinel UUID

# === SOW DOMAIN ===
lib/queries/scopes-of-work.ts
lib/queries/sow-task-links.ts
lib/data/scopes-of-work/
  index.ts                     # SOW business logic
  sharing.ts                   # Share token management
  task-generation.ts           # Phase-to-task generation
  version-history.ts           # Version snapshot creation, restore
lib/scopes-of-work/
  types.ts                     # SOWContent, SOWPhase + Zod schemas
  transform-from-proposal.ts   # Proposal → SOW content mapping

# === BILLING SETTINGS ===
lib/data/billing-settings.ts   # Cached singleton read, admin update

# === ACTIVITY EVENTS ===
lib/activity/events/invoices.ts
lib/activity/events/scopes-of-work.ts

# === API ROUTES ===
app/api/integrations/stripe/webhook/route.ts
app/api/cron/monthly-invoices/route.ts
app/api/public/invoices/[token]/route.ts
app/api/public/invoices/[token]/pay/route.ts
app/api/public/sow/[token]/route.ts
app/api/public/sow/[token]/approve/route.ts

# === DASHBOARD ROUTES ===
app/(dashboard)/invoices/
  page.tsx
  _components/
  _actions/
  settings/
    page.tsx
    _actions/

app/(dashboard)/projects/[clientSlug]/[projectSlug]/scopes/
  page.tsx
  [sowId]/
    page.tsx
  _components/
  _actions/

# === PUBLIC ROUTES ===
app/(public)/invoice/[shareToken]/
  page.tsx
  invoice-client.tsx
  payment-form.tsx

app/(public)/sow/[shareToken]/
  page.tsx
  approval-flow.tsx
```
