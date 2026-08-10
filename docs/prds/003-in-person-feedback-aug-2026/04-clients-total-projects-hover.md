# 04 — Clients: Total-Projects Hover Card

**Depends on:** Nothing (parallelizable)
**App:** `apps/internal/`
**Decisions:** D9 (see [README.md](README.md))
**Review codes:** W8, W9, I3, PW2, R8 (see [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

## Problem

On the Clients list ([clients-landing.tsx](<../../../apps/internal/app/(dashboard)/clients/_components/clients-landing.tsx>),
Projects cell ~L108–115), "{N} active" has a hover card listing the active projects, but
"({N} total)" is plain, non-interactive text
([active-projects-cell.tsx](<../../../apps/internal/app/(dashboard)/clients/_components/active-projects-cell.tsx>) ~L76–80,
and the zero-active branch ~L36–40). Ask: "Add hover dropdown for total projects the same way as
active projects."

Constraint discovered in the scan: the data layer only fetches a **count** for total —
[fetchClientsWithMetrics](../../../apps/internal/lib/data/clients/index.ts) computes `projectCount`
via SQL filter (~L108–116) and fetches the per-client project **list** with an active-only status
filter (~L210–239). The full list isn't client-side today.

## Fix

Widen the per-client project-list query to all non-deleted projects (any status), selecting
`status`; derive both lists server-side. Make the "(N total)" span a second `HoverCard` trigger
listing every project with a status badge. Display rule unchanged: the total affordance appears only
when `totalProjectCount > activeCount` (D9).

## Implementation

### 1. Data layer — [apps/internal/lib/data/clients/index.ts](../../../apps/internal/lib/data/clients/index.ts)

- Rename/widen the row type (L20–24): `ClientActiveProject` → `ClientProjectSummary`
  `{ id, name, slug, status }`. **(I3)** Type `status` as `ProjectStatusValue` from
  [lib/constants.ts](../../../apps/internal/lib/constants.ts) (L1–3; labels/tokens at L5–13, L35–44).
  The rename is a verified 2-file change — `lib/data/clients/index.ts` and the cell are the only
  users of the type; `.activeProjects` is read only by `clients-landing.tsx:110`.
- The second query (~L210–239): **drop** the `lower(status) in ('active','onboarding')` predicate,
  keep `inArray(clientIds)` + `isNull(projects.deletedAt)` + `orderBy(asc(projects.name))`, add
  `status` to the select. One query, same round-trip count as today.
- Group into `projectsMap`; on each `ClientWithMetrics` set:
  - `allProjects: ClientProjectSummary[]` (new)
  - `activeProjects` — derived by filtering `allProjects` on `ACTIVE`/`ONBOARDING` (existing
    consumers keep working; the definition of *active* is unchanged: status ∈ {ACTIVE, ONBOARDING}
    ∧ `deletedAt IS NULL`; *total* = `deletedAt IS NULL`, any status — includes ON_HOLD and
    COMPLETED)
- Counts (`projectCount`, `activeProjectCount`, ~L108–116) stay as SQL aggregates — don't re-derive
  from the lists; they're already correct and used elsewhere.

### 2. Cell — [active-projects-cell.tsx](<../../../apps/internal/app/(dashboard)/clients/_components/active-projects-cell.tsx>)

- New prop: `allProjects: ClientProjectSummary[]` (alongside existing `projects`, `clientSlug`,
  `clientId`, `totalProjectCount`).
- Replace the plain `({totalProjectCount} total)` spans (L36–40 zero-active branch, L76–80 normal
  branch) with a second `HoverCard` + `HoverCardTrigger` styled like the active trigger
  (dotted-underline button; **(I3)** preserve the per-branch tones — the normal branch is
  `text-muted-foreground/60`, the zero-active branch is `/50`).
- `HoverCardContent` mirrors the active card (`align='start'`, `w-56 p-0` — widen to `w-64` if
  status badges crowd): `<ul className='py-1'>` of rows — `FolderKanban` icon, truncated name,
  right-aligned status badge. **(I3)** Badge pattern:
  `<Badge variant='outline' className={cn('text-xs', getProjectStatusToken(status))}>` — tokens are
  Tailwind className strings (established call site: `clients/[clientSlug]/_components/client-detail.tsx:316`).
- **(W9, PW2)** The list is unbounded (a long-lived client can have dozens of COMPLETED projects):
  wrap the `<ul>` in `max-h-80 overflow-y-auto`. The payload growth (all non-deleted projects for
  every client on the page) is accepted — same query count, admin-only page.
- Links: same builder as active items (L29, L60–64) — `slug ?? id` fallbacks,
  `` href={`/projects/${clientPath}/${projectPath}/tasks`} `` for **all** statuses (D9).
- **(W8) Coordinate the two hovers — the timers guarantee overlap otherwise.** The shared wrapper
  ([components/ui/hover-card.tsx](../../../apps/internal/components/ui/hover-card.tsx) — popover-based,
  `OPEN_DELAY = 50` / `CLOSE_DELAY = 200`) means sliding between triggers shows both cards for
  ~150ms. Extend the wrapper with **optional controlled props** (`open?: boolean`,
  `onOpenChange?: (open: boolean) => void`, backward-compatible — uncontrolled when absent), then
  hold `openCard: 'active' | 'total' | null` in the cell so opening one force-closes the other.
  **(R8) Timer semantics are part of the contract, not an implementation detail:** when the wrapper
  is controlled, entering a controlled-open state must **cancel that instance's pending
  open/close timers**, and a close callback may clear the shared state **only if it is still the
  owner** — use a functional update (`setOpenCard(cur => cur === 'active' ? null : cur)`), never a
  bare `setOpenCard(null)`. Otherwise the active card's stale 200ms close timer fires after the
  total card opens and wipes it.
  Keyboard note **(I3)**: the wrapper has no focus handler — cards open on pointer-enter or
  click-activation (Enter/Space), not on focus; parity with the active trigger is the bar.
- Reference for a second implementation of the same pattern:
  [contacts/_components/linked-clients-cell.tsx](<../../../apps/internal/app/(dashboard)/contacts/_components/linked-clients-cell.tsx>) (~L24–49)
  — unaffected by the wrapper extension (props are optional).

### 3. Out of scope / notes

- The clients **archive** page's `clients-management-table.tsx` (bare `activeProjects` number, no
  total column) is untouched.
- Pre-existing inconsistency (do **not** fix here, flagged in
  [06-future-scope.md](06-future-scope.md)): `lib/queries/clients/settings/list-clients.ts`
  `totalProjects` doesn't filter `deletedAt` and its `activeProjects` ignores ONBOARDING — that
  query feeds the settings/archive surface, not this page.

## Acceptance criteria

- [ ] Hovering "({N} total)" shows a card listing **all** non-deleted projects (any status) with status badges, alphabetical
- [ ] Each item links to `/projects/{clientSlug|id}/{projectSlug|id}/tasks`
- [ ] Active-projects hover unchanged (items, links, styling)
- [ ] Display rule unchanged: total affordance only when total > active; zero-active branch also gets the hover
- [ ] Opening one hover card closes the other (W8 coordination); no state where both are fully open
- [ ] The total card scrolls within `max-h-80` when the list is long (W9)
- [ ] Soft-deleted projects appear in neither card and neither count
- [ ] Clients with 0 projects render as today (no hover affordances)
- [ ] Keyboard: triggers are buttons (focusable); card opens on Enter/Space activation — parity with the active trigger (I3: the wrapper has no on-focus open)
- [ ] Contacts linked-clients hover still works (wrapper extension is backward-compatible)
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root

## Files

**Modified:**
- `apps/internal/lib/data/clients/index.ts` (type + query + assembly)
- `apps/internal/app/(dashboard)/clients/_components/active-projects-cell.tsx`
- `apps/internal/app/(dashboard)/clients/_components/clients-landing.tsx` (pass `allProjects`)
- `apps/internal/components/ui/hover-card.tsx` (optional controlled `open`/`onOpenChange`, W8)
