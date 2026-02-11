# 04: Monthly Billing Cron

> Part of [PRD 009: Invoices & Scopes of Work](./README.md)
> Related: [02-invoice-system.md](./02-invoice-system.md) | [08-integration-architecture.md](./08-integration-architecture.md)

## Overview

A Vercel Cron job runs on the **1st of each month** (`"0 10 1 * *"` — 10:00 UTC / 5:00 AM EST or 6:00 AM EDT). It generates draft invoices for **net-30 clients only**. Prepaid invoices are always created manually.

## Endpoint

```
GET /api/cron/monthly-invoices
├── Auth: Vercel Cron secret (CRON_SECRET, Bearer token — matches gmail-sync pattern)
├── NOTE: Vercel Cron sends GET requests (not POST)
├── Schedule: "0 10 1 * *" (1st of month, 10:00 UTC)
```

## Steps

1. Query all active clients with `billing_type = 'net_30'`.
2. **Duplicate detection:** For each client, check if a draft invoice already exists for the same billing period (`billing_period_start` + `billing_period_end`). If so, skip that client and log a skip reason.
3. For each net-30 client, query `time_logs` for all CLIENT-type projects where `logged_on` falls within the previous calendar month. **Use timezone-aware date boundaries** matching the existing pattern (`America/Los_Angeles`): `logged_on >= first_of_previous_month AND logged_on < first_of_current_month`.
4. Create one `HOURS_WORKED` line item **per project** (e.g., "Project Alpha — 12 hrs @ $X/hr", "Project Beta — 8 hrs @ $X/hr").
5. Create invoice in `DRAFT` status for admin review.
6. Admin reviews draft, adds any `CUSTOM` line items, then sends.

## New Time Log Query

A new query is required that does not currently exist in `lib/queries/time-logs.ts`:

```typescript
fetchTimeLogSummaryByProjectForClient(clientId, periodStart, periodEnd)
```

Aggregates hours per project for a client within a date range. Returns project-level summaries for line item generation.

## Partial Failure Handling

If the cron generates invoices for 10 clients and fails on client 5, the first 4 invoices are already created in DRAFT status. This is acceptable — drafts require manual review anyway.

**Return format:**
```typescript
{ generated: number, skipped: number, errors: string[] }
```

## Manual Fallback

A "Generate Monthly Invoices" button in the invoice UI triggers the same logic on demand. The duplicate detection check prevents double-creation.

## Vercel Plan Note

The project already has 2 crons (`gmail-sync`, `email-scheduled`). Vercel Hobby allows 2 cron jobs; adding a 3rd requires the **Pro plan** (up to 40 crons). Verify the current Vercel plan before implementation.
