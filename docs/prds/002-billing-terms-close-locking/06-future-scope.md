# 06 — Future scope

Deferred deliberately; revisit when the trigger condition occurs.

- **Prepaid block balances + depletion alerts — recommended next PRD (audit PW1/PW2).** As the book goes prepaid, "how many hours do I have left?" becomes every client's first question, and noticing "Acme's block is nearly out" becomes the operational heartbeat for selling the next block. One PRD covers both: a remaining-hours view in the client portal (`apps/client/` — client-facing, brand-quality bar) and a low-balance signal in the internal portal, sharing the same balance computation (hours purchased minus hours logged since the prepaid boundary).
- **Effective-dated commission assignments** (third priority) — `clients.origination_user_id` / `origination_contact_id` / `closer_user_id` have the identical history-rewriting exposure as billing type. Own PRD; copy the `client_billing_terms` shape (same table pattern, `…AsOfSql` resolution, cache column, month-start cutover). Until then, close snapshots contain the damage — reassignments surface as drift and closed months stay frozen.
- **Roll-forward adjustments** — when a *paid-out* closed month gets a late entry, post the delta into the next open month as an explicit adjustment line instead of reopen → re-close (which rewrites what was paid). Build the first time a real already-paid straggler occurs; snapshots already record exactly what was paid, so the delta is computable.
- **Future-dated billing change scheduling** — pending-state UI + daily cache-sync cron + cancellation. Cut from this PRD: changes apply at save (D10) and the prepaid migration is one-way. If ever built, note `activity_logs.actor_id` is NOT NULL — attribute cron events to the term's `created_by`.
- **5-hour minimum block size** — sales policy, deliberately unenforced (comps/promos/remainders stay legitimate). If entry mistakes occur, add a soft `warning` below 5 hours in the hour-block sheet.
- **Partner rate schedule → DB** — stays in code per its documented rationale.
- **Auto-close reminder** — a cron that *nudges* when a prior month is still open past the Nth; close stays a human action (D6).
- **Closed-month PDF/export** — snapshot JSONB makes an "as-paid" statement export trivial.
- **Mid-month cutovers with proration** — rejected (D3); would force per-time-log resolution and prorated block attribution.
- **Drift notification** — email/push when drift appears on a closed month, instead of discovery on next visit.
