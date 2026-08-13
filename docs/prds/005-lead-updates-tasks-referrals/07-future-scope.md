# 06 — Future Scope

**PRD:** [005](README.md)

Everything discussed but deliberately deferred, with the reason and the trigger for revisiting.

---

## Deferred by explicit decision

### Client task visibility (D12) — the big one

**Asked for:** Kris, bullet 2: *"we are connecting tasks to the client portal and sometimes we want
to create internal tasks for leads that we don't want the client to see, how should we handle? Each
task has a visibility toggle for client viewing with color coding?"*

**Why deferred:** Jason, Phase 1: *"let's defer the client task visibility work — not thought
through enough on my end yet."*

**Why deferring is safe right now.** D8 + D9 make lead tasks structurally invisible to the portal:
`apps/client/lib/data/tasks.ts` selects with `eq(tasks.projectId, projectId)`, and a `NULL`
`project_id` can never satisfy an equality predicate. Lead tasks never enter a client project
(D9 — no transfer on conversion), so there is no exposure path.

**The state of the art if this is picked up.** Phase 1 established these, and they don't need
re-deriving:

- There is **no** visibility column on `tasks` today.
- Portal exposure is purely project-scoped; only `id`, `title`, and `status` are selected —
  descriptions are deliberately withheld already.
- **Every task in a CLIENT project is visible today.** Any new column defaulting to private would
  silently hide tasks clients currently see. Jason's Phase 1 preference was: default visible,
  backfill all existing tasks to visible, and default to private only for lead-originated tasks.
- "Color coding" would attach to visibility state here; D5 currently assigns color to update type
  only, so the two would need to stay visually distinguishable.

**Revisit when:** someone needs an internal-only task inside a *client* project — the case D9 rules
out for lead tasks but which is entirely plausible for ordinary project work.

**Do not** implement this by making the portal query null-tolerant. See C6 in
[04](04-lead-task-placement.md).

---

### Predefined task presets (D11)

**Asked for:** Kris: *"Should these tasks be mostly predefined — follow up, send (document,
proposal, engagement letter, etc), other."*

**Why deferred:** Jason chose free text over both a template picker and a `taskKind` enum.

**Notes for later.** The two options costed in Phase 1:

- *Template picker* — presets prefill the title (and optionally a due-date offset); the task stays
  free-text underneath. No schema change, fully reversible.
- *`taskKind` enum column* — enables real reporting ("how many follow-ups outstanding", "average
  days to send a proposal"), at the cost of putting a lead-sales concept on the shared `tasks` table
  used by every project.

**Revisit when:** there's evidence from real lead-task titles about which kinds recur. That evidence
now exists for the first time, since lead tasks are lead-anchored and countable.

---

### Moving lead tasks to the client on conversion (D9)

**Why deferred:** Jason: *"let's keep tasks on the lead and don't transfer anything."*

The third Phase 1 option was a checkbox list in the conversion dialog — pick which open lead tasks
move to the new client project. `convert-lead-dialog.tsx` already has the pattern
(`copyNotesToClient`, `createProject`).

**Revisit when:** someone complains that post-close onboarding work logged during the sale is
stranded on a converted lead. **Depends on client task visibility** landing first — moving tasks
into a client project without a visibility gate would expose them.

---

## Deferred from update types (D3)

The launch enum is `MEETING`, `PHONE_CALL`, `EMAIL`, `NOTE`. Considered and cut:

### Gmail-derived EMAIL updates (D20 — highest-value next step)

`EMAIL` ships as a **manual** type, but the codebase already has Gmail OAuth sync
(`apps/internal/app/api/cron/gmail-sync/`, the `email-attachments` bucket, `oauth_connections`).
Nothing links synced mail to leads today, which is why auto-derivation was deferred rather than
built.

**Why this matters more than the other deferrals:** hand-logging "I emailed them" beside a live
email integration is exactly the duplicate entry people quietly abandon. An abandoned last-touch is
*wrong*, not merely missing — a lead reads as untouched when it isn't, and D19's staleness dot then
fires on leads that are actually fine. Manual `EMAIL` is the weakest link in the cadence chain.

**When picked up:** match synced threads to `leads.contact_email`, and make a synced signal
**supersede** a manual one for the same interaction rather than double-counting. Needs a dedup rule
against existing manual entries and a backfill decision.

### Text / SMS

A separate type — texting behaves differently from email for cadence purposes. Cheap to add:
one enum value, one label, one icon, one token, and inclusion in `LEAD_TOUCH_TYPES`.

### Proposal sent / Document sent

Outbound-artifact touches. Would enable "days from proposal to response" as a metric, and covers
some of what the dropped task presets would have. Note the overlap with the existing
`PROPOSAL_SENT` lead **status** — two ways to record the same fact is a modeling problem worth
thinking through, not just an enum addition.

### Inbound vs outbound direction

Not a type but a second dimension on every update. Makes "they've gone quiet" answerable — the lead
replied three weeks ago and we've sent two emails since.

**This is what would give `leads.awaiting_reply` a real basis.** That column is dropped in
[03](03-updates-timeline-ui.md) under D4, precisely because nothing writes it and direction tracking
is deferred. If direction is implemented, **re-derive awaiting-reply from the updates table rather
than resurrecting the stored column** — same reasoning as D4, and the reason dropping it now costs
nothing later.

---

## Deferred infrastructure

### Lead task time logging (D10)

Lead tasks can't be time-logged; the UI is hidden and the API rejects it.

**Revisit when:** someone wants to know what pre-sales effort costs. Requires reworking the
`time_log_task_matches_project` database CHECK — whose function body **is not in this repository**
and exists only in the live database (see [04](04-lead-task-placement.md)). Read it first. It also
feeds monthly-close aggregation, so any change is a reporting change.

### Promote submission → lead

Already in PRD 001 future scope, **declined by Kris**: *"trying to keep as little manual work as
possible."*

Worth re-raising in light of a finding from this PRD: **leads currently have no inbound path at
all.** The marketing site was cut off `leads-intake`, submissions land in `form_submissions`, and
promote-to-lead was never built — so every lead is hand-created. That may be the intent, but it's
worth confirming it's still the intent.

### Lead-side origination reporting

[05](05-lead-origination-model.md) gives leads a real referrer FK for the first time, which makes
"which referrers send us the most leads, and which convert?" answerable. Nothing in this PRD builds
that view. The monthly-close origination and partner-payout reports remain client-scoped.

### `contact_leads` beyond origination

[05](05-lead-origination-model.md) revives the table for the referrer link only. It could also carry
the lead's own contact people (a lead with three stakeholders), which is closer to what the table's
name suggests. Out of scope here.

---

## Not deferred — actively rejected

| Item | Why |
| --- | --- |
| Extending `task_comments` for updates | D2. `taskId` is `NOT NULL` with a cascade FK; reuse needs a schema change anyway and mixes two unrelated concerns in one table and one UI. |
| A polymorphic lead+client interactions table | D1. Jason: *"ignore clients."* Would be the right shape *if* client interaction logging is ever wanted — revisit the Phase 1 mutex design rather than bolting a second table alongside `lead_updates`. |
| Storing last-touch as a column | D4. Derived state goes stale on edit or delete of the underlying update. |
| A settings-backed lead-task project pointer | Considered in Phase 1 as a cheaper alternative to D8. Rejected because it keeps lead tasks pooled in one internal project, which is the structure Kris objected to. |
| Last-touch **text** on the leads board card | D17. The card keeps a single badge in the old source slot, showing origination. Adding a date string to seven columns of cards costs density for a number that's one click away in the sheet. **Superseded in part by D19** — a staleness *dot* now conveys the actionable signal without the text. |
| A stored `is_stale` column | D19. Staleness is a pure function of `status`, `lastTouchAt`, and now — same reasoning as D4. A stored copy is wrong the moment a threshold changes or a day passes. |
| `lead_update_id` on `tasks` | D21. The follow-up shortcut is a workflow convenience, not a relationship. "Which calls generated work" is a question nobody has asked; adding the column now would be schema for a hypothetical report. |
| Archived lead tasks in a project archive | D18. A lead task has no project, so there is no project archive to put it in. The lead sheet holds its own history (C11). |
| Preserving unmatched `source_detail` text | D15. Jason: *"you can drop the source detail value altogether if it's not a contact."* The pre-flight audit in 05 is the review step that replaces a preservation column. |
| Fuzzy-matching referrer names in the backfill | W8. A false attribution flows into client origination and then into partner payouts. |
