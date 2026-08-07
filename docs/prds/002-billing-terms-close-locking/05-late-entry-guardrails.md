# 05 — Late-entry guardrails

Catch closed-month collisions **at write time** instead of leaving discovery to the drift banner. Guardrails **warn, they don't block** (D9) — logging late is a legitimate workflow; the drift banner (04) is the backstop.

## Closed-month warning rule

A write "touches a closed month" when:

- **Time log create/update/delete**: `logged_on` (new or existing value) falls in a month with an active snapshot. An update that *moves* a log across a closed boundary trips on either side — **the route must read the existing `logged_on` before mutating** (F6): the PATCH body only carries the new date and `updateTimeLog` overwrites in place, so a move *out of* a closed month is undetectable after the fact.
- **Hour block create/edit/archive/restore**: the block's `billing_month` is closed. Creates can trip only when the current month was closed early (billing_month never points backward).

Check via `isMonthClosed(date)` from the section 03 data layer — one indexed `getClosedMonthSet` lookup per action.

## Plumbing (C1: time logs are API routes, not actions)

**Warnings are admin-only (I4):** CLIENT-role users can log time in the internal app ([mutations.ts](../../../apps/internal/lib/queries/time-logs/mutations.ts) permits own-user logs), and "drift on the Monthly Close Report" is internal-ops language. Compute the `warning` only when the authenticated user is ADMIN; client users' late logs are still caught by the drift banner (04). Hour-block actions are already admin-only, so this only gates the time-log path.

**Time logs** — written via API routes, there is no time-log actions dir:

1. In `apps/internal/app/api/projects/[projectId]/time-logs/route.ts` (POST) and `.../[timeLogId]/route.ts` (PATCH/DELETE): after the mutation succeeds, run the closed-month check and include `warning?: string` in the JSON response alongside the existing result — `'August 2026 is closed — this change will show as drift on the Monthly Close Report until it is reopened and re-closed.'` The check stays out of `lib/queries/time-logs/mutations.ts` (queries stay minimal per the two-layer convention).
2. The React Query mutation handlers in the time-log sheet components surface `warning` as a warning-variant toast. Inventory the callers during implementation (project time-logs tab, task-sheet time logging) — anywhere the response's `error` is handled gains the `warning` branch.

**Hour blocks** — server actions: extend `ActionResult` in [apps/internal/app/(dashboard)/hour-blocks/actions/types.ts](<../../../apps/internal/app/(dashboard)/hour-blocks/actions/types.ts>) with `warning?: string`; the sheet surfaces it the same way.

The mutation always **proceeds** — no confirm-before-save dialog; a blocking dialog would punish the normal workflow.

## Pre-boundary purchases: no warning needed

The pre-boundary purchase warning this section previously specified is **replaced by `hour_blocks.billing_month`** (section 01, F7): a block created before the client's prepaid boundary — manually or by the Stripe webhook — is attributed to the first prepaid month and counts there. The manual save can still show an informational note ("This block will be billed in September") when `billing_month` lands ahead of the current month, but nothing is at risk if it doesn't.

## Hard block (from section 01, restated)

Billing-type changes whose `effective_from` lands in a closed month are **rejected**, not warned. The error names the month and points at Reopen.

## Acceptance criteria

- [ ] Creating a time log dated inside a closed month saves and shows the warning toast; the drift banner subsequently appears on that month
- [ ] Editing hours on / archiving a closed-month time log or hour block warns; open-month writes never warn
- [ ] Moving a log's `logged_on` between a closed and an open month warns once **in both directions** (prior date captured before mutation); open → open never warns
- [ ] Creating an hour block for a client with a future prepaid boundary saves with `billing_month` = the boundary month and the informational note; no closed-month warning unless that month is closed
- [ ] A billing change targeting a closed month is blocked with the reopen-first error
- [ ] A CLIENT-role user logging time into a closed month gets no warning (admin-only), and the log still shows as drift on the closed month
- [ ] No warning plumbing leaks into `apps/client/`
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from repo root
