# PRD 006 — Lead Updates (slim)

**Status:** Implemented on `prd-005-lead-updates-slim`
**Created:** 2026-08-14, as a deliberate scope reduction of PRD 005
**Supersedes:** the unshipped `prd-005-lead-updates-tasks-referrals` branch, which is **parked, not
deleted** — its five other sections (lead-anchored tasks, origination model, staleness dots, board
filters, lead settings) live there with full review history if any is ever resurrected.

---

## Why this exists

PRD 005 grew to six interlocking sections across eight migrations. Jason's call on 2026-08-14:
*"I've bitten off more than I can chew — reduce to just the updates flow, hard-code lead tasks to
the Sales project, kill the referral linking and all board filtering."* Follow-up decisions in the
same session: the staleness dot dies too (no thresholds anywhere), and the composer's
"Add follow-up task" checkbox dies with it.

## What shipped

1. **The §01 crash fix** — `lib/leads/sales-project.ts` is now the single `getOrCreateSalesProject`.
   The divergent `sales-strategy` copy in `lib/sheets/init/resolvers.ts` (bare insert, no guard —
   the thing that created phantom projects and could 500 every task sheet) is deleted. The shared
   module also fixes the latent `onConflictDoNothing` bug: `idx_projects_slug` is a **partial**
   unique index, so the arbiter needs `where: isNotNull(projects.slug)` or the guard itself throws
   on the exact conflict it exists to absorb.
2. **`lead_updates` table** — migration `0062_lead_updates.sql`, purely additive. Four types
   (MEETING / PHONE_CALL / EMAIL / NOTE), plain-text body, `occurred_at` distinct from `created_at`,
   soft deletes, author FK `ON DELETE RESTRICT` (an update is an audit record; users are disabled,
   not deleted).
3. **Updates timeline in the lead sheet** — below Tasks in the right column. Composer (type, date
   capped at today client-side + Zod-refined server-side, 5000-char body), newest-first timeline
   with per-type icon + label + color (never color alone), per-entry soft delete, loading skeleton,
   explicit error state with Retry, and a **"Last touched N days ago"** summary derived from
   `MAX(occurred_at)` over MEETING/PHONE_CALL/EMAIL — **notes never count as a touch**.
4. **`LEAD_UPDATE_LOGGED` activity event**, plus the W13 fix: every lead action now also
   revalidates `/leads/activity`.

## What was deliberately cut (do not scope-creep back in)

| Cut | Where it lives if wanted later |
| --- | --- |
| `tasks.project_id` nullable / lead-anchored tasks | parked branch §04 — lead tasks stay hard-coded to the internal **Sales** project |
| Origination model, referrer contacts, `contact_leads` revival | parked branch §05 — `leads.source_type` / `source_detail` remain exactly as on main |
| Staleness dot + per-stage thresholds + `/leads/settings` | parked branch §03/§06 |
| Board filter row (follow-up toggle, assignee filter) | parked branch §03 |
| Composer "Add follow-up task" checkbox (D21/D24) | parked branch §03 |
| `leads-intake` route removal | parked branch §05 — the route stays live on main |
| Dropping `last_contact_at` / `awaiting_reply` | parked branch §03 — both columns stay (write-never, read-but-dead), no destructive migration in this PRD |

## Deploying

1. Merge; apply `0062_lead_updates.sql` to production (`npm run db:migrate:prod` from the **main
   checkout**, not a worktree). Purely additive — no sign-offs required, nothing destroyed.
2. No env vars, no backfills, no seed scripts, no Vercel changes.
3. Production timelines start **empty** — `last_contact_at` history is not migrated into
   `lead_updates` (the local dev clone carries 19 synthesized EMAIL-typed rows for feel; those are
   local fixtures only, and the "original channel unknown" caveat is why they were never promoted
   to a production backfill).

## Verification

Type-check, lint, and build pass from the repo root. Browser-verified on the production clone:
timeline render, compose/save/delete round-trips, last-touch derivation, and task-sheet init from a
non-canonical route (the §01 regression) — see the branch's commit message for the run details.
