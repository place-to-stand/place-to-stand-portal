# 07: Data Model Reference

> Part of [PRD 009: Invoices & Scopes of Work](./README.md)
> This is the complete schema reference. Individual sections are explained in their domain files.

## New Tables

### `invoices`

```
invoices
├── id                       UUID PRIMARY KEY
├── client_id                UUID NOT NULL (FK → clients, ON DELETE RESTRICT)
├── status                   invoice_status ENUM
├── invoice_number           TEXT UNIQUE
│                            -- Auto-generated via PG SEQUENCE: "INV-2026-0001"
│                            -- CHECK (invoice_number ~ '^[A-Z0-9]{2,10}-\d{4}-\d{4,}$')
│                            -- Nullable: assigned on DRAFT → SENT transition
├── billing_period_start     DATE               -- NULL for prepaid ad-hoc
├── billing_period_end       DATE               -- NULL for prepaid ad-hoc
├── subtotal                 NUMERIC(12,2) NOT NULL DEFAULT 0
├── tax                      NUMERIC(12,2) NOT NULL DEFAULT 0
├── total                    NUMERIC(12,2) NOT NULL DEFAULT 0
├── currency                 VARCHAR(3) DEFAULT 'USD'
├── due_date                 DATE
├── paid_at                  TIMESTAMP
├── sent_at                  TIMESTAMP
├── share_token              VARCHAR(64) UNIQUE
├── share_enabled            BOOLEAN DEFAULT false
├── stripe_payment_intent_id TEXT
├── stripe_payment_status    TEXT
├── payment_method           TEXT
├── notes                    TEXT
├── created_by               UUID NOT NULL (FK → users, ON DELETE RESTRICT)
├── created_at               TIMESTAMP
├── updated_at               TIMESTAMP
├── deleted_at               TIMESTAMP
```

**Indexes:**
- `idx_invoices_client (client_id) WHERE deleted_at IS NULL`
- `idx_invoices_status (status) WHERE deleted_at IS NULL`
- `idx_invoices_share_token (share_token) WHERE deleted_at IS NULL AND share_token IS NOT NULL AND share_enabled = true`
- `idx_invoices_billing_period (billing_period_start, billing_period_end) WHERE deleted_at IS NULL`
- `idx_invoices_created_by (created_by) WHERE deleted_at IS NULL`
- `idx_invoices_due_date (due_date) WHERE deleted_at IS NULL AND status NOT IN ('PAID', 'VOID', 'REFUNDED')`
- `UNIQUE partial on stripe_payment_intent_id WHERE stripe_payment_intent_id IS NOT NULL`

### `invoice_line_items`

```
invoice_line_items
├── id              UUID PRIMARY KEY
├── invoice_id      UUID NOT NULL (FK → invoices, ON DELETE CASCADE)
├── type            line_item_type ENUM
├── description     TEXT NOT NULL
├── quantity        NUMERIC(8,2) NOT NULL
├── unit_price      NUMERIC(12,2) NOT NULL
├── amount          NUMERIC(12,2) NOT NULL     -- CHECK (amount = quantity * unit_price)
├── hour_block_id   UUID (FK → hour_blocks, ON DELETE SET NULL)
├── metadata        JSONB
├── sort_order      INTEGER NOT NULL DEFAULT 0
├── created_at      TIMESTAMP
├── updated_at      TIMESTAMP
├── deleted_at      TIMESTAMP
```

**Indexes:**
- `idx_invoice_line_items_invoice (invoice_id) WHERE deleted_at IS NULL`
- `idx_invoice_line_items_hour_block (hour_block_id) WHERE deleted_at IS NULL AND hour_block_id IS NOT NULL`

### `billing_settings` (singleton)

```
billing_settings
├── id                         UUID PRIMARY KEY
│                              -- Fixed: '00000000-0000-0000-0000-000000000001'
│                              -- CHECK (id = '00000000-0000-0000-0000-000000000001')
├── hourly_rate                NUMERIC(12,2) NOT NULL DEFAULT 200.00
├── company_name               TEXT
├── company_address            TEXT
├── company_logo_url           TEXT
├── default_payment_terms_days INTEGER DEFAULT 30
├── invoice_number_prefix      TEXT DEFAULT 'INV'
├── created_at                 TIMESTAMP
├── updated_at                 TIMESTAMP
├── updated_by                 UUID (FK → users, ON DELETE SET NULL)
```

### `scopes_of_work`

```
scopes_of_work
├── id                    UUID PRIMARY KEY
├── project_id            UUID NOT NULL (FK → projects, ON DELETE CASCADE)
├── proposal_id           UUID (FK → proposals, ON DELETE SET NULL)
├── title                 TEXT NOT NULL
├── status                sow_status ENUM
├── version               INTEGER NOT NULL DEFAULT 1
├── content               JSONB NOT NULL
├── total_estimated_hours NUMERIC(8,2)    -- Denormalized SUM(phases[].estimatedHours)
├── share_token           VARCHAR(64) UNIQUE
├── share_enabled         BOOLEAN DEFAULT false
├── approved_at           TIMESTAMP
├── approved_by_name      TEXT
├── approved_by_email     TEXT
├── created_by            UUID NOT NULL (FK → users, ON DELETE RESTRICT)
├── created_at            TIMESTAMP
├── updated_at            TIMESTAMP
├── deleted_at            TIMESTAMP
```

**Indexes:**
- `idx_sow_project (project_id) WHERE deleted_at IS NULL`
- `idx_sow_status (status) WHERE deleted_at IS NULL`
- `idx_sow_share_token (share_token) WHERE ... AND share_enabled = true`
- `idx_sow_proposal (proposal_id) WHERE deleted_at IS NULL AND proposal_id IS NOT NULL`
- `idx_sow_created_by (created_by) WHERE deleted_at IS NULL`

### `sow_task_links`

```
sow_task_links
├── id          UUID PRIMARY KEY
├── sow_id      UUID NOT NULL (FK → scopes_of_work, ON DELETE CASCADE)
├── task_id     UUID NOT NULL (FK → tasks, ON DELETE CASCADE)
├── phase_id    VARCHAR(36) NOT NULL
├── created_at  TIMESTAMP
├── updated_at  TIMESTAMP
├── deleted_at  TIMESTAMP
├── UNIQUE(sow_id, task_id)
```

**Indexes:**
- `idx_sow_task_links_sow (sow_id)`
- `idx_sow_task_links_task (task_id)`

### `sow_versions`

```
sow_versions
├── id              UUID PRIMARY KEY
├── sow_id          UUID NOT NULL (FK → scopes_of_work, ON DELETE CASCADE)
├── version_number  INTEGER NOT NULL
├── content         JSONB NOT NULL
├── content_hash    VARCHAR(64) NOT NULL
├── change_summary  TEXT
├── created_by      UUID NOT NULL (FK → users, ON DELETE RESTRICT)
├── created_at      TIMESTAMP NOT NULL
├── updated_at      TIMESTAMP
├── deleted_at      TIMESTAMP
├── UNIQUE(sow_id, version_number)
```

**Indexes:**
- `idx_sow_versions_sow (sow_id, version_number DESC)`
- `idx_sow_versions_dedup (sow_id, content_hash)`

## Modified Tables

| Table | Changes |
|-------|---------|
| `tasks` | Add `estimated_hours` NUMERIC(8,2) — nullable, safe migration |

**`hour_blocks` is NOT modified.** Hour block → invoice linkage navigates through `invoice_line_items.hour_block_id`. Legacy `hour_blocks.invoiceNumber` field is not dropped but new code should not write to it.

## New Enums

| Enum | Values |
|------|--------|
| `invoice_status` | `DRAFT`, `SENT`, `VIEWED`, `PAID`, `PARTIALLY_PAID`, `REFUNDED`, `VOID` |
| `line_item_type` | `HOURS_PREPAID`, `HOURS_WORKED`, `CUSTOM` |
| `sow_status` | `DRAFT`, `IN_REVIEW`, `REVISION_REQUESTED`, `APPROVED`, `IN_PROGRESS`, `COMPLETED`, `SUPERSEDED` |

## Relations (`lib/db/relations.ts`)

| From | To | Type | FK / Via |
|------|----|------|----------|
| `clients` | `invoices` | one-many | `invoices.client_id` |
| `invoices` | `invoice_line_items` | one-many | `line_items.invoice_id` |
| `invoice_line_items` | `hour_blocks` | one-one? | `line_items.hour_block_id` |
| `users` | `invoices` | one-many | `invoices.created_by` |
| `users` | `billing_settings` | one-one | `billing_settings.updated_by` |
| `projects` | `scopes_of_work` | one-many | `sow.project_id` |
| `proposals` | `scopes_of_work` | one-many | `sow.proposal_id` (optional) |
| `scopes_of_work` | `sow_task_links` | one-many | `links.sow_id` |
| `tasks` | `sow_task_links` | one-many | `links.task_id` |
| `scopes_of_work` | `sow_versions` | one-many | `versions.sow_id` |
| `users` | `scopes_of_work` | one-many | `sow.created_by` |
| `users` | `sow_versions` | one-many | `versions.created_by` |

## ON DELETE Behaviors

| FK Column | ON DELETE | Rationale |
|-----------|----------|-----------|
| `invoices.client_id` | RESTRICT | Never cascade-delete financial records |
| `invoices.created_by` | RESTRICT | Preserve audit trail |
| `invoice_line_items.invoice_id` | CASCADE | Owned by invoice |
| `invoice_line_items.hour_block_id` | SET NULL | Hour block removal preserves line item |
| `scopes_of_work.project_id` | CASCADE | Owned by project |
| `scopes_of_work.proposal_id` | SET NULL | Proposal removal preserves SOW |
| `scopes_of_work.created_by` | RESTRICT | Preserve audit trail |
| `sow_task_links.sow_id` | CASCADE | Owned by SOW |
| `sow_task_links.task_id` | CASCADE | Owned by task |
| `sow_versions.sow_id` | CASCADE | Owned by SOW |
| `sow_versions.created_by` | RESTRICT | Preserve audit trail |
| `billing_settings.updated_by` | SET NULL | Settings survive user removal |

**Existing inconsistency:** `hour_blocks.clientId` uses `ON DELETE CASCADE` which conflicts with the RESTRICT philosophy for financial data. Future cleanup — not addressed here.

## Entity Relationship Diagram

```
clients ─────────┬──── invoices ──── invoice_line_items ──── hour_blocks
                  │                   (line_items.hour_block_id navigates
                  │                    to the hour block purchased)
                  │
                  └──── projects ──── scopes_of_work ──── sow_task_links ──── tasks
                                          │                (link via stable phase_id)
                                          └──── sow_versions
```
