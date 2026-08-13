# PRD 005 — Lead Updates, Task Placement, and Origination

**Status:** Ready for implementation
**Created:** 2026-08-13
**Depends on:** Nothing. All sections are implementable against `main` today.
**Blocks:** Client-facing task visibility (deferred here — see [07-future-scope.md](07-future-scope.md)).
**App scope:** `apps/internal` **only**. No section touches `apps/client`. Schema changes land in `packages/db`.

---

## Source material

Archived verbatim at [source/notes.md](source/notes.md) — three bullets Jason captured from a
discussion with Kris on 2026-08-13.

### Accuracy notes

**No Gemini summary was provided for this session**, so the usual "verify the summary against the
transcript" check is a no-op. There is no AI-generated interpretation to audit — the archived
bullets are the only source of truth. What was flagged instead, during Phase 1:

| # | Issue | Resolution |
| --- | --- | --- |
| 1 | Two of three bullets end in **open questions, not decisions** ("Could it just be comments labelled updates?", "Should these tasks be mostly predefined?", "Maybe source needs to be rethought altogether?") | Resolved in the Phase 1 question rounds. See Key Decisions — D2, D11, D13. |
| 2 | Bullet 2 contains one **firm defect report**: *"tasks in a lead adding to a hardcoded project that actually no longer exists"* | Confirmed and found to be **worse than described**. See [01-sales-project-defect.md](01-sales-project-defect.md). |
| 3 | "Color coding" is unspecified — coding *what*? | Resolved: update type only (D5). Task visibility coding deferred with D12. |

### Repeat-ask sweep

Grepped `source/` transcripts in PRDs 001 and 003 (002 and 004 have no archived source) plus every
section file across 001–004.

**Zero repeat asks.** Two near-misses recorded so they are not miscounted in a future sweep:

- The `referral` hits in `001-submissions-organization/source/` are all **Shopify Partner revenue
  share** (the $2,500 Plus referral fee, 20% POS for 24 months). A business-development topic with
  no relationship to `leads.source_type`.
- `003-in-person-feedback-aug-2026/07-future-scope.md:14` is a **deferred item now coming due**, not
  a repeat ask. PRD 003 D1 deliberately kept the lead-task quick-capture overlay on close-on-save and
  wrote: *"If lead-task creation grows into a fuller flow… adopt the 01 pattern."* Bullet 2 is that
  growth. Carried into [04-lead-task-placement.md](04-lead-task-placement.md).

---

## What this PRD covers

1. **Fix the phantom Sales project defect** — a live bug that can 500 every task sheet.
2. **Add a lead Updates timeline** — logged interactions (meeting, call, email, note), with
   time-since-last-touch **and** a forward-looking follow-up signal: a staleness dot on the board
   card plus a "Needs follow-up" filter.
3. **Re-anchor lead tasks to the lead** — `tasks.projectId` becomes nullable; no more hardcoded
   project.
4. **Replace the lead source model with an origination model** mirroring clients, with a migration
   path off `source_type` / `source_detail`, and retire the dead `leads-intake` webhook.
5. **Add a `/leads/settings` tab** where the follow-up cadence thresholds are configured, so tuning
   them doesn't need a deploy.

## What is NOT in scope

- **Client-side task visibility.** Explicitly deferred by Jason: *"not thought through enough on my
  end yet."* See D12 and [07-future-scope.md](07-future-scope.md).
- **Any client-portal (`apps/client`) change.** Jason: *"these changes are consolidated to leads
  only, ignore clients."* Nothing in this PRD alters what a portal user sees.
- **Predefined task presets** (follow-up / send document / send proposal). Dropped per D11.
- **Moving lead tasks onto a client project at conversion.** Dropped per D9.
- **Promote-submission→lead.** Remains in PRD 001 future scope, declined by Kris.
- **Time logging against lead tasks.** Unavailable by design (D10).

---

## Sections

| # | File | Topic | Complexity | Schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| 01 | [01-sales-project-defect.md](01-sales-project-defect.md) | Delete the divergent `getOrCreateSalesProject`; one source of truth | Low | No | — |
| 02 | [02-schema-lead-updates.md](02-schema-lead-updates.md) | `lead_updates` table + `lead_update_type` enum | Medium | **Yes** | — |
| 03 | [03-updates-timeline-ui.md](03-updates-timeline-ui.md) | Updates timeline UI; derived last-touch; staleness dot + follow-up filter; retire dead columns | **High** | **Yes** (drop) | 02 |
| 04 | [04-lead-task-placement.md](04-lead-task-placement.md) | `tasks.projectId` nullable; lead as anchor | High | **Yes** | 01 |
| 05 | [05-lead-origination-model.md](05-lead-origination-model.md) | Origination model + migration; retire `leads-intake` | High | **Yes** | — |
| 06 | [06-lead-settings.md](06-lead-settings.md) | `/leads/settings` tab; configurable staleness thresholds | Medium | **Yes** | — |
| 07 | [07-future-scope.md](07-future-scope.md) | Deferred items with context | Low | No | — |

---

## Key decisions

| # | Decision | Rationale |
| --- | --- | --- |
| **D1** | Updates are **leads-only**. No client-side interaction log. | Jason, Phase 1: *"i mispoke, these changes are consolidated to leads only, ignore clients."* Collapses what would have been a polymorphic `interactions` table into a single-FK `lead_updates`. |
| **D2** | **New `lead_updates` table**, not extended `task_comments`. | Kris asked *"Could it just be comments labelled updates?"* — no. [`task_comments.taskId`](../../../packages/db/src/schema.ts) is `NOT NULL` with FK cascade to `tasks`; a lead update has no task to hang from. Reuse would require making that column nullable anyway, and would mix task discussion with relationship history in one table and one UI. |
| **D3** | Update types at launch: **Meeting, Phone call, Email, Note**. | The three Kris named plus a catch-all. Text/SMS, proposal-sent, and inbound/outbound direction deferred (see 07). |
| **D4** | **Derive** last-touch as `MAX(occurred_at)` over `lead_updates`. **Drop both `leads.last_contact_at` and `leads.awaiting_reply`.** | Both columns have been write-never since they shipped — read at four sites in `apps/internal/lib/data/leads/index.ts`, written nowhere. Project convention (memory: *"Computed vs stored status"*) is that derived state is computed in queries, not stored, because a stored copy goes stale the moment an update is edited or deleted. `awaiting_reply` extended into this decision at consistency-check: it is equally dead, the same read sites are being edited anyway, and the feature that would give it a basis (inbound/outbound direction) is deferred to 07, which specifies re-deriving it rather than resurrecting the column. |
| **D5** | Color + icon coding on **update type only**. | Jason's pick. Task-visibility coding depends on D12, which is deferred. Color never carries meaning alone — every type gets an icon and a text label (WCAG 1.4.1). |
| **D6** | Updates render in the lead sheet's **right column, below Tasks**. | Least disruption to `lead-sheet-right-column.tsx`, which already has `overflow-y-auto`. Keeps the at-a-glance "last touched 12 days ago, 2 open tasks" read that tabs would hide. |
| **D7** | **One** source of truth for lead-task placement. Delete the copy in `lib/sheets/init/resolvers.ts`. | Two divergent implementations existed; one was actively wrong and unguarded. See 01. |
| **D8** | **`tasks.projectId` becomes nullable.** A lead task's anchor is its lead. | Kris: *"This would allow us to save the task to the client and not in the general sales strategy project… I don't like the current structure of tasks in a lead adding to a hardcoded project."* Jason picked this over a settings-backed project pointer. |
| **D9** | **No task transfer on conversion.** Lead tasks stay on the lead forever. | Jason, Phase 1: *"let's keep tasks on the lead and don't transfer anything."* |
| **D10** | Lead tasks (null `project_id`) **cannot be time-logged**. | Keeps the existing `time_log_task_matches_project` CHECK working unchanged for every project task. Pre-sales time isn't billable to a client anyway. |
| **D11** | **No predefined task presets.** Free text only. | Jason's pick over a template picker or a `taskKind` enum. Revisit once there's evidence about which kinds people actually create. |
| **D12** | **Client task visibility is deferred**, not designed here. | Jason: *"let's defer the client task visibility work — not thought through enough on my end yet."* D8 + D9 make this safe: a null-`project_id` task can never match the portal's `projectId` filter, so lead tasks are structurally invisible to clients. |
| **D13** | **Replace** `source_type` / `source_detail` with an origination model mirroring `clients`. | Jason: *"i just realized that the client has a toggle that lets you select internal partner or external contact as the origination… it needs to be fully rethought with a migration path away from the old way."* Same shape on both sides makes conversion a field copy rather than a translation layer. |
| **D14** | **Remove** `/api/integrations/leads-intake`. | The marketing site was already cut over off it — [`docs/integrations/marketing-form-submissions.md:22`](../../integrations/marketing-form-submissions.md). Leaving it live means a write path that bypasses the new origination model and can still set the enum values D13 removes. |
| **D15** | On migration, `source_detail` values that **don't resolve to a contact are discarded**. No preservation column. | Jason, mid-Phase-2: *"you can drop the source detail value altogether if it's not a contact."* Removes the `origination_note` column from the design and makes the destructive migration (0065) a clean drop. Unmatched text is lost — see the pre-flight audit in 05, which is now the only chance to review it. |
| **D16** | On conversion, the lead's **assignee** is copied into `clients.closer_user_id`. | Jason, mid-Phase-2: *"you can copy the assignee into the closer FK on clients as well."* The person working the lead is the person who closed it. Pairs with D13's origination copy so conversion populates both halves of the client's attribution — the monthly-close origination and partner-payout reports read these fields. |
| **D17** | The lead card's removed source badge is replaced by an **origination badge in the same slot and style** — kind as the label, referrer name on hover. Last-touch is **not** shown on the card. | Jason, consistency-check: *"keep a similar badge like the current referral one that shows the name on hover. do something that makes sense with the new structure."* `lead-card.tsx` already renders exactly this shape (outline badge + `sourceDetail` tooltip), so the swap is like-for-like. Keeps board card density unchanged — see W11. |
| **D18** | An archived lead task stays visible in the **lead sheet's Tasks section**, shown as archived, **with a restore affordance**. It never appears in a project archive. | Jason, consistency-check. Project archive routes are project-scoped and a lead task has no project, so without this an archived lead task would vanish from the UI entirely — which no other entity in this codebase does. Consistent with D8: the lead is the anchor, so the lead holds the history. See C11. |
| **D19** | The board gets a **staleness dot on the lead card** plus a **"Needs follow-up" filter**, thresholded per stage. | Audit P1. The PRD as written measured cadence *backwards* only — "last touched 12 days ago" inside the sheet, with D17 keeping it off the card. For an agency with **no account managers** (per placetostandagency.com), the actionable half is "who is overdue right now." Without a prompt, logging updates is a chore producing a number nobody acts on. The dot is a separate, tiny affordance so D17's badge slot and card density are preserved. |
| **D20** | `EMAIL` stays a **manual** update type for now. | Audit PW4. Gmail OAuth sync exists (`api/cron/gmail-sync`) but is not wired to leads at all, so auto-derivation is its own project. Recorded in 07 as the first candidate to become automatic — and when it does, last-touch must **prefer a synced signal over a manual one** rather than double-counting. |
| **D21** | The update composer carries an optional **"Add follow-up task"** checkbox that opens task quick-capture prefilled with the lead. | Audit PW5. The natural motion is *log a call → create a follow-up*, and D11 removed the presets that would otherwise scaffold it. Workflow shortcut only — **no schema link** between an update and a task (that was the rejected third option). |
| **D22** | Staleness thresholds are **configurable** on a new **Settings tab at `/leads/settings`**, seeded with 3 / 7 / 7 / 30. | Jason, consistency-check: *"go with 3 / 7 / 7 / 30 but can you add a settings toggle to the leads view? use the invoices settings page as an example."* The numbers were invented during authoring and set the entire feature's signal-to-noise ratio; tuning a guess should not require a deploy. Own section — [06](06-lead-settings.md). |
| **D23** | The board gains a **filter row** with the "Needs follow-up" toggle **and an assignee filter**, state in URL params via `useListParams`. | Jason, consistency-check. The board has **no toolbar today**, so the row is new either way — and a lone toggle in an empty row is thin. The board is shared across the team, so an assignee filter makes *"my overdue leads"* one step. Status filtering excluded (the kanban columns *are* the statuses); search excluded (the command palette covers it). URL params match every other filtered list, including the leads archive tab. |
| **D24** | The D21 follow-up task **prefills its due date** to `today + <stage threshold>`. | Jason, consistency-check. A dateless follow-up task surfaces nowhere, reintroducing the passivity D19 exists to fix. Sourcing the offset from the same configured threshold means the dot and the follow-up cadence cannot drift apart. |

---

## What already exists

| Thing | Current state | This PRD changes it to |
| --- | --- | --- |
| `getOrCreateSalesProject` | **Two divergent copies.** `create-lead-task.ts:39` uses slug `sales`, is conflict-safe. `resolvers.ts:235` uses slug `sales-strategy`, bare insert, no guard. | One copy, or none — see 01 + 04. |
| `scripts/dedupe-sales-project.ts` | One-off cleanup that soft-deletes phantom projects. **Running it arms a unique-violation crash.** | Safe to run once 01 lands — **and it must be run then**, because 04 deletes it (W7). |
| `tasks.lead_id` | Exists, FK to `leads` with `ON DELETE SET NULL`, partial index `idx_tasks_lead`. | Unchanged. Becomes the primary anchor for lead tasks. |
| `tasks.project_id` | `NOT NULL`, FK cascade, **three** indexes reference it (`idx_tasks_project`, `idx_tasks_project_archived`, `idx_tasks_project_status_rank`). | **Nullable.** |
| `leads.last_contact_at` | Read at 4 sites, **written at 0**. | **Dropped.** Derived from `lead_updates`. |
| `leads.awaiting_reply` | Read at 4 sites, **written at 0**. | **Dropped** (D4). |
| `lead-card.tsx` source badge | Outline badge showing the source label, with `sourceDetail` on hover. | **Origination badge** in the same slot and style — kind as the label, referrer name on hover (D17). |
| `leads.source_type` (`REFERRAL`/`WEBSITE`/`EVENT`) | `WEBSITE` has had no producer since the marketing cutover. `EVENT` marked "reserved", never used. | **Dropped.** Replaced by origination model. |
| `leads.source_detail` | Free text — no FK, so nothing can carry over to a client. | **Dropped.** Values that resolve to a contact become the origination link; the rest are discarded (D15). |
| `clients.closer_user_id` | Exists; `convert-lead.ts` passes `null`. Read by monthly-close partner payouts. | Populated from the lead's assignee on conversion (D16). |
| `contact_leads` table | **Fully dead.** Table + unique constraint + 2 indexes exist; only references anywhere are two type exports in `lib/types/client-contacts.ts:12-13`. | Revived as the lead↔contact link. |
| `clients.origination_contact_id` / `origination_user_id` / `closer_user_id` | Exist, behind `clients_origination_mutex` CHECK. `convert-lead.ts` passes all three as `null`. | Populated from the lead's origination on conversion. |
| `ClientOriginationPicker` | Working internal-partner / external-contact toggle for clients. | **Pattern mirrored** onto leads. Not modified. |
| `/api/integrations/leads-intake` | Live, token-authed, writes directly to `leads`. No known caller. | **Removed.** |
| `apps/client/lib/data/tasks.ts` | Selects tasks by `projectId`; returns id/title/status only. | **Unchanged.** Null-`project_id` tasks can never match it. |

---

## Schema changes summary

**Five migrations** (six if §03 generates its own — see the ownership note below), generated from
`packages/db/` with `npm run db:generate -- --name <label>`. **Never hand-write or hand-edit these
files** — `AGENTS.md:9` allows no exceptions, and an earlier draft of this PRD wrongly claimed two.

Drizzle cannot express data backfills or seeds, so those are **standalone scripts** under
`apps/internal/scripts/`, modeled on `dedupe-sales-project.ts`: idempotent, logging counts, run
explicitly after the migration applies.

| Script | Section | Purpose |
| --- | --- | --- |
| `backfill-lead-task-projects.ts` | 04 | Null `project_id` on existing lead tasks (W22) |
| `backfill-lead-origination.ts` | 05 | Resolve `source_detail` → contact, unambiguously (W24) |
| `seed-lead-stage-settings.ts` | 06 | Seed the 3/7/7/30 thresholds |

> **Migration numbering:** the last committed migration is `0061_add_tasks_completed_at.sql`.
> Sections 02, 04, and 06 add one each; **section 05 adds two** (additive, then destructive — W9).
> Whoever implements first claims `0062`. Numbers are assigned by `drizzle-kit` in generation
> order, so the intended sequence below is a recommendation, not a constraint — do not renumber by
> hand to match it.

| Intended # | Section | Label | Change |
| --- | --- | --- | --- |
| 0062 | 02 | `lead_updates` | **New table** `lead_updates`; **new enum** `lead_update_type`. |
| 0063 | 04 | `tasks_nullable_project` | `tasks.project_id` → nullable. Partial-index review. |
| 0064 | 05 | `lead_origination` | Add origination columns + mutex CHECK + FKs; backfill. |
| 0065 | 05 | `drop_lead_source` | **Drop** `source_type` + `source_detail`; **drop enum** `lead_source_type`. Kept separate so the additive half can deploy and be verified first (W9). |
| 0066 | 06 | `lead_stage_settings` | **New table** `lead_stage_settings` + seeded 3/7/7/30 defaults. Additive only. |

**Ownership of the `last_contact_at` / `awaiting_reply` drop:** section **03** owns that decision
(D4) and its pre-flight audit (A1). Section 05 touches the same table, so if 05 lands first the drop
may ride along in its destructive migration instead of generating its own. Whichever section carries
it, **it must be dropped exactly once** — coordinate before generating, and record which migration
carried it in [PROGRESS.md](PROGRESS.md).

**Destructive changes requiring explicit sign-off before running in production:**

- **Dropping `leads.source_detail` (05) destroys data.** Per D15 there is no preservation column —
  any value that doesn't resolve to a contact is gone. The pre-flight audit in
  [05](05-lead-origination-model.md) is the **only** chance to review what will be lost. Run it and
  read the output before generating the migration.
- Dropping the `lead_source_type` enum (05) — irreversible without a restore.
- Dropping `leads.last_contact_at` / `awaiting_reply` (03, D4) — both are write-never, so no data
  loss, but **verify that claim against production first** (audit A1). A non-zero count means
  something writes them and §03's premise is wrong — stop rather than dropping anyway (W5).

### Infrastructure

| Kind | Item | Section |
| --- | --- | --- |
| **New table** | `lead_updates` | 02 |
| **New table** | `lead_stage_settings` | 06 |
| **New enum** | `lead_update_type` | 02 |
| **New route** | `/leads/settings` (+ Settings tab in `LEADS_TABS`) | 06 |
| **New columns** | `leads.origination_contact_id`, `leads.origination_user_id` | 05 |
| **Modified column** | `tasks.project_id` → nullable | 04 |
| **Revived table** | `contact_leads` (exists, currently unused) | 05 |
| **Dropped columns** | `leads.source_type`, `leads.source_detail`, `leads.last_contact_at`, `leads.awaiting_reply` | 03, 05 |
| **Dropped enum** | `lead_source_type` | 05 |
| **Removed route** | `apps/internal/app/api/integrations/leads-intake/` | 05 |
| **Removed env var** | `LEADS_INTAKE_TOKEN` (from `turbo.json`, `.env.example`, Vercel) | 05 |

---

## Implementation order

```
        ┌────────────────────────────┐
        │ 01 sales-project-defect    │  Low · no schema · SHIP FIRST
        └─────────────┬──────────────┘
                      │
                      ▼
        ┌────────────────────────────┐
        │ 04 lead-task-placement     │  High · schema
        └────────────────────────────┘

   ┌──────────────────────┐   ┌──────────────────────┐
   │ 02 schema-lead-      │   │ 06 lead-settings     │  Medium · schema
   │    updates           │   │  (thresholds table)  │
   └──────────┬───────────┘   └──────────┬───────────┘
              │                          │
              └────────────┬─────────────┘
                           ▼
        ┌────────────────────────────┐
        │ 03 updates-timeline-ui     │  High · schema (drop)
        └────────────────────────────┘   needs BOTH 02 and 06

        ┌────────────────────────────┐
        │ 05 lead-origination-model  │  High · schema + migration
        └────────────────────────────┘   (independent — start early)
```

### Recommended sequence

| Step | Do | Why |
| --- | --- | --- |
| 1 | **01 alone, merged on its own.** | It fixes a live bug. Do not let it wait behind the rest of the PRD. ~10 lines. |
| 2 | **02, 05, and 06 in parallel** (separate branches). | Mutually independent and independent of 01. 05 is the longest pole — start it early. |
| 3 | **03** after **both 02 and 06** land. | Needs `lead_updates` to read from *and* `lead_stage_settings` for D19's thresholds (D22). |
| 4 | **04** after 01 lands. | 01 removes the divergent resolver that 04 would otherwise have to reason about. |

**Parallelizable:** 01 ∥ 02 ∥ 05 ∥ 06, then 03 ∥ 04.
**Strictly sequential:** 02 → 03, 06 → 03, and 01 → 04.

**Migration conflict warning:** 02, 04, 05, and 06 all generate migrations (05 generates two). If run
in parallel branches they will race for the same number. Rebase and regenerate rather than
renumbering by hand — `drizzle-kit` maintains `meta/_journal.json` alongside the SQL, and
hand-editing desynchronizes them.

**File conflict warning:** **§03 and §05 both modify
[`lead-card.tsx`](apps/internal/app/(dashboard)/leads/_components/lead-card.tsx)** — §03 adds the
staleness dot (D19), §05 swaps the source badge for origination (D17). Neither owns the file.
Whichever lands second rebases, and the dot must not displace or restyle the badge (W11).

---

## Tracking

- [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md) — definition of record for the C#/W# codes cited
  throughout the section files.
- [PROGRESS.md](PROGRESS.md) — per-section checklist, updated after each coding session.
- [TEST-PLAN.md](TEST-PLAN.md) — manual test plan, updated after each coding session.
