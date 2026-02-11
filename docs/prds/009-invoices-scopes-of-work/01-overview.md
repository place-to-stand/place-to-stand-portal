# 01: Overview

> Part of [PRD 009: Invoices & Scopes of Work](./README.md)

## Problem Statement

Invoicing and scope-of-work management happen outside the portal:

- **Invoicing**: Created and sent manually through QuickBooks. When a prepaid client pays, an admin manually records the hour block in the portal via the Hour Blocks screen (`/hour-blocks`). Net-30 clients are invoiced on the 1st of each month based on time logs, but the tally and invoice creation happen outside the portal.
- **Hour Blocks UI**: A stopgap CRUD screen where invoice data is copied in by hand. To be replaced with full invoice management.
- **Scopes of Work**: Proposals capture phases, deliverables, risks, and rates in structured JSONB content (see `lib/proposals/`). Once accepted, the transition to actionable project tasks is manual — there is no formal SOW document that breaks down phases into estimated hours and feeds into task creation.
- **Version Control**: No document versioning. Tasks and proposals are edited in place.

## Goals

1. **Centralize invoice lifecycle** — Generate, share, and track invoices from within the portal. Public-facing invoice pages with embedded Stripe payment.
2. **Automate monthly billing** — Vercel Cron on the 1st of each month generates draft invoices for net-30 clients. Prepaid invoices remain manual.
3. **Auto-credit hour blocks** — When a prepaid invoice is paid via Stripe, automatically create the corresponding hour block record.
4. **Stripe payment integration** — Embedded Stripe Elements on the public invoice page for card/ACH payment. Stripe webhooks for real-time payment confirmation.
5. **Configurable rates** — Invoice settings screen with global hourly rate (starting at $200/hr).
6. **Formalize scopes of work** — SOWs live inside projects, contain phased hour estimates and deliverables, and require client approval (simple button, not signature) before work begins.
7. **SOW-to-task generation** — Accepted SOWs produce one task per phase. Tasks link back to the SOW phase and read content live (no content duplication).
8. **SOW version history** — Version snapshots for SOW content to track changes through the review/approval cycle.

## Out of Scope

- Stripe's built-in invoicing feature (we build our own invoice UI/document; Stripe is payment processing only).
- Automated contract/legal document generation beyond SOW structure.
- Full audit trail for every field change on every entity (activity logs continue to serve that purpose).
- Per-client custom rates (future — global rate for now; schema supports `COALESCE(client.hourly_rate, billing_settings.hourly_rate)` extension).
- Invoice status audit trail / history table (future — could follow `lead_stage_history` pattern).
- SOW templates (future — compatible with current JSONB content structure).
- Multi-currency (future — `currency` field on invoices provides foundation).

## Related Files

- [02-invoice-system.md](./02-invoice-system.md) — Invoice data model and UI
- [03-stripe-and-payments.md](./03-stripe-and-payments.md) — Payment integration
- [05-scopes-of-work.md](./05-scopes-of-work.md) — SOW system
- [10-decisions-risks-deps.md](./10-decisions-risks-deps.md) — All resolved decisions
