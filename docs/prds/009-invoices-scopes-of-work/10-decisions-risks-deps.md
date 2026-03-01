# 10: Decisions, Risks & Dependencies

> Part of [PRD 009: Invoices & Scopes of Work](./README.md)

## Permissions & Access Control

| Action | Admin | Client User |
|--------|-------|-------------|
| View invoices (admin UI) | Yes (all) | No |
| Create / edit invoices | Yes | No |
| View & pay invoice (share link) | N/A | Yes (via public share link) |
| Mark invoices paid manually | Yes | No |
| View SOWs for their project | Yes (all) | Yes (own client's projects) |
| Create / edit SOWs | Yes | No |
| Approve SOWs (client-facing link) | N/A | Yes (via share link) |
| View SOW version history | Yes | No |
| Generate tasks from SOW | Yes | No |

## Observability & Analytics (PostHog)

| Event | Properties |
|-------|-----------|
| `invoice_created` | `billing_type`, `total`, `line_item_count` |
| `invoice_sent` | `invoice_id`, `client_id` |
| `invoice_paid` | `invoice_id`, `days_to_payment`, `payment_method` |
| `invoice_refunded` | `invoice_id`, `client_id` |
| `invoice_voided` | `invoice_id`, `client_id` |
| `monthly_invoices_generated` | `count`, `total_value` |
| `sow_created` | `project_id`, `phase_count`, `total_estimated_hours` |
| `sow_sent_for_review` | `sow_id`, `project_id` |
| `sow_approved` | `sow_id`, `days_to_approval` |
| `sow_revision_requested` | `sow_id`, `project_id` |
| `sow_tasks_generated` | `sow_id`, `task_count` |
| `sow_version_created` | `sow_id`, `version_number` |
| `sow_version_restored` | `sow_id`, `from_version`, `to_version` |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Stripe webhook reliability | Missed payments | Validate signatures. Idempotent `markInvoicePaid()`. Manual polling fallback. Log all events. |
| Stripe webhook duplicates | Duplicate hour blocks | Idempotency check (return early if PAID). Transaction wraps status + hour block atomically. |
| Invoice number concurrency | Duplicate numbers | PG SEQUENCE for atomic numbering. UNIQUE constraint. Number assigned on DRAFT→SENT. |
| Public invoice security | Guessable share links | Cryptographically random tokens via `lib/sharing/`. Rate-limit public routes. |
| Cron reliability | Missed net-30 invoices | Monitoring/alerting. Manual "Generate Now" fallback. Duplicate detection. |
| Cron duplicate runs | Duplicate drafts | Dedup: skip if draft exists for same client + billing period. |
| SOW version storage | JSONB accumulation | Content hash dedup prevents identical versions. Consider retention policy. |
| Payment disputes | Client disputes charge | Stripe handles disputes. Portal marks `REFUNDED` via webhook. |
| SOW phase deletion | Orphaned task links | Stable `phase_id`. Orphaned links detectable. UI shows warning. |
| Soft-deleted SOW display | Task can't render phase | Query without `deletedAt` filter, or show "SOW archived" placeholder. |

## Resolved Decisions

| Question | Decision |
|----------|----------|
| Billing provider | Stripe (not QuickBooks). Portal owns invoice UI. |
| Invoice delivery | Public page with share link (like proposals). |
| Payment method | Embedded Stripe Elements on public invoice page. |
| Invoice numbering | PG SEQUENCE (`INV-YYYY-NNNN`). Assigned on DRAFT→SENT. |
| Net-30 line item granularity | One line item per project. |
| Prepaid auto-generation | Manual only — cron handles net-30 only. |
| Invoice sidebar placement | Sales section (replaces Hour Blocks). |
| Hourly rates | Single global rate ($200/hr). Per-client deferred. |
| Client invoice visibility | Clients pay via public share link. No in-portal view. |
| OVERDUE status | Computed from `due_date < NOW()`, not stored enum. |
| Hour block ↔ invoice linkage | Navigate via `invoice_line_items.hour_block_id`. No bidirectional FK. |
| SOW phase identification | Stable `phase_id` (nanoid), not array index. |
| SOW approval mechanism | Button approval (name, email, timestamp). No signature. |
| Task generation granularity | One task per phase. |
| SOW-task content sync | Link via `phase_id`, don't copy — live read. |
| Task PRD format | Deferred to future phase. |
| Version control scope | SOW versioning only (dedicated table with content_hash dedup). |
| Cron provider | Vercel Cron with duplicate detection. |
| SOW templates | Not needed — build from scratch or pre-populate from proposal. |
| Sharing infrastructure | Shared `lib/sharing/` module extracted from proposals. |
| Public page routing | All under `app/(public)/` route group. |
| Webhook idempotency | Shared `markInvoicePaid()` with early return. Transaction-wrapped. |
| Email notifications | Resend for client-facing emails. |
| billing_settings singleton | CHECK constraint + sentinel UUID. UPSERT. Seeded in migration. |
| Soft delete consistency | All new tables include `deleted_at`. |

## Dependencies

- **PRD 007** (Clients & CRM): Client data model, billing type field, client detail pages.
- **PRD 008** (OAuth & Email): Proposal system, Gmail integration, sharing infrastructure (to be extracted into `lib/sharing/`).
- **Stripe Account**: API keys (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) and webhook secret (`STRIPE_WEBHOOK_SECRET`).
- **Vercel Cron**: Monthly scheduling (`vercel.json`). **Note:** Project has 2 crons already; 3rd requires Pro plan.
- **Resend**: For client-facing invoice email delivery (existing `lib/email/resend.ts`).
- **nanoid**: For stable SOW phase IDs (or use `crypto.randomUUID()`).
