---
title: '009: Invoices & Scopes of Work'
status: 'draft'
author: 'Jason Desiderio'
date: '2026-02-07'
---

# 009: Invoices & Scopes of Work

Centralize invoice lifecycle with Stripe payments, automate monthly billing for net-30 clients, and formalize SOWs that generate project tasks.

## File Index

| File | Scope | When to Read |
|------|-------|--------------|
| [01-overview.md](./01-overview.md) | Goals, current state, out of scope | Starting the project or onboarding |
| [02-invoice-system.md](./02-invoice-system.md) | Invoice data model, statuses, line items, settings, UI | Working on invoice schema or UI |
| [03-stripe-and-payments.md](./03-stripe-and-payments.md) | Stripe integration, webhooks, public invoice page, `markInvoicePaid()` | Working on payment flow |
| [04-monthly-billing-cron.md](./04-monthly-billing-cron.md) | Net-30 cron job, duplicate detection, time log queries | Working on automated billing |
| [05-scopes-of-work.md](./05-scopes-of-work.md) | SOW data model, content structure, UI, approval flow | Working on SOW creation/editing |
| [06-sow-tasks-and-versions.md](./06-sow-tasks-and-versions.md) | SOW-to-task generation, version history, `sow_task_links` | Working on task generation or versioning |
| [07-data-model-reference.md](./07-data-model-reference.md) | Complete schema: all tables, enums, relations, indexes, ON DELETE | Writing migrations or schema code |
| [08-integration-architecture.md](./08-integration-architecture.md) | Shared sharing module, public routes, email, activity events | Working on shared infrastructure |
| [09-implementation-phases.md](./09-implementation-phases.md) | Phase 1-4 breakdown, migration ordering, file structure | Planning sprints or understanding build order |
| [10-decisions-risks-deps.md](./10-decisions-risks-deps.md) | Resolved decisions, risks, permissions, analytics, dependencies | Reviewing architectural choices |
| [TASKS.md](./TASKS.md) | Implementation task list with status tracking | Every session — check/update progress |
| [TEST-PLAN.md](./TEST-PLAN.md) | Manual test plan with test cases | Every session — verify completed work |

## Dependency Graph

```
Phase 1 — Invoice Foundation + Stripe
├── 1.1 Extract shared sharing module (no deps)
├── 1.2 Invoice schema + enums + billing_settings (no deps)
├── 1.3 Stripe integration library (no deps)
├── 1.4 Invoice queries & data layer (depends: 1.2)
├── 1.5 Activity events for invoices (depends: 1.2)
├── 1.6 Invoice admin UI (depends: 1.2, 1.4)
├── 1.7 Public invoice page + Stripe Elements (depends: 1.1, 1.3, 1.4)
├── 1.8 Stripe webhook endpoint (depends: 1.3, 1.4)
├── 1.9 markInvoicePaid + hour block auto-creation (depends: 1.4, 1.8)
├── 1.10 Invoice email notifications (depends: 1.4, 1.7)
└── 1.11 Legacy hour blocks migration (depends: 1.6)

Phase 2 — Monthly Cron + Dashboard
├── 2.1 Time log summary query (depends: 1.4)
├── 2.2 Monthly invoice cron endpoint (depends: 1.4, 2.1)
├── 2.3 Manual "Generate Now" button (depends: 2.2)
└── 2.4 Dashboard widgets (depends: 1.4)

Phase 3 — Scopes of Work + Version History
├── 3.1 SOW schema + enums (no deps)
├── 3.2 SOW types + Zod schemas (no deps)
├── 3.3 SOW queries & data layer (depends: 3.1, 3.2)
├── 3.4 SOW editor UI (depends: 3.1, 3.3)
├── 3.5 SOW sharing + public page (depends: 1.1, 3.3)
├── 3.6 SOW approval flow (depends: 3.5)
├── 3.7 Proposal-to-SOW transform (depends: 3.2)
├── 3.8 SOW version history (depends: 3.3)
└── 3.9 Activity events for SOWs (depends: 3.1)

Phase 4 — SOW-to-Task Generation
├── 4.1 sow_task_links schema + estimated_hours on tasks (depends: 3.1)
├── 4.2 Task generation engine (depends: 3.3, 4.1)
├── 4.3 Task sheet SOW integration (depends: 4.1, 4.2)
└── 4.4 SOW detail task status display (depends: 4.2, 4.3)
```

### Parallelization Opportunities

**Can run in parallel:**
- 1.1 (sharing module) + 1.2 (invoice schema) + 1.3 (Stripe lib) — all independent foundations
- 1.5 (activity events) + 1.6 (admin UI) — after 1.2/1.4
- Phase 3 tasks 3.1-3.2 can start in parallel with Phase 2 — no cross-dependencies
- 3.4 (SOW editor) + 3.5 (sharing) + 3.7 (proposal transform) — after 3.3

### Cross-Phase Dependencies

```
Phase 1 ──────────── Phase 2 (cron needs invoice data layer)
    │
    └── 1.1 (sharing) ── Phase 3.5 (SOW sharing reuses it)

Phase 3 ──────────── Phase 4 (task gen needs SOW data layer)
```

**Phase 1 and Phase 3 are independent** — invoice tables and SOW tables have no foreign keys between them. Their migrations can run in any order.

## Quick Reference

| Task | Complexity | Dependencies | Status |
|------|-----------|--------------|--------|
| 1.1 Shared sharing module | Low | None | Pending |
| 1.2 Invoice schema | Medium | None | Pending |
| 1.3 Stripe integration | Medium | None | Pending |
| 1.4 Invoice data layer | Medium | 1.2 | Pending |
| 1.5 Invoice activity events | Low | 1.2 | Pending |
| 1.6 Invoice admin UI | High | 1.2, 1.4 | Pending |
| 1.7 Public invoice page | High | 1.1, 1.3, 1.4 | Pending |
| 1.8 Stripe webhook | Medium | 1.3, 1.4 | Pending |
| 1.9 markInvoicePaid | Medium | 1.4, 1.8 | Pending |
| 1.10 Invoice emails | Low | 1.4, 1.7 | Pending |
| 1.11 Legacy hour blocks | Low | 1.6 | Pending |
| 2.1 Time log summary query | Low | 1.4 | Pending |
| 2.2 Monthly cron | Medium | 1.4, 2.1 | Pending |
| 2.3 Generate Now button | Low | 2.2 | Pending |
| 2.4 Dashboard widgets | Medium | 1.4 | Pending |
| 3.1 SOW schema | Medium | None | Pending |
| 3.2 SOW types + Zod | Low | None | Pending |
| 3.3 SOW data layer | Medium | 3.1, 3.2 | Pending |
| 3.4 SOW editor UI | High | 3.1, 3.3 | Pending |
| 3.5 SOW sharing + public page | Medium | 1.1, 3.3 | Pending |
| 3.6 SOW approval flow | Medium | 3.5 | Pending |
| 3.7 Proposal-to-SOW transform | Low | 3.2 | Pending |
| 3.8 SOW version history | Medium | 3.3 | Pending |
| 3.9 SOW activity events | Low | 3.1 | Pending |
| 4.1 sow_task_links schema | Low | 3.1 | Pending |
| 4.2 Task generation engine | Medium | 3.3, 4.1 | Pending |
| 4.3 Task sheet SOW integration | Medium | 4.1, 4.2 | Pending |
| 4.4 SOW task status display | Low | 4.2, 4.3 | Pending |
