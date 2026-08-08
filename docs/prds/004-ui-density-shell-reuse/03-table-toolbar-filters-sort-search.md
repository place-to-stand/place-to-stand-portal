# 03 — Table Toolbar: Filters, Sort, Search

**Depends on:** 01 (toolbar composes into `PageShell`'s content area; palette route exists for record-search extension)
**App:** `apps/internal/`
**Decisions:** D5, D6, D7, D13 (see [README.md](README.md))
**Review codes:** W2, W3, I1, PW3, R2, R5 (see [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

## Problem

Filters exist on exactly three views, in two incompatible idioms:

- **Users** ([users-filters.tsx](<../../../apps/internal/app/(dashboard)/settings/users/_components/users-filters.tsx>)) + **Submissions** ([submissions-filters.tsx](<../../../apps/internal/app/(dashboard)/submissions/_components/submissions-filters.tsx>)): URL-param single-`Select`s, server-filtered. The `updateParams` closure is **byte-for-byte duplicated** (users ~L42–57 ≡ submissions ~L48–63), differing only in the pagination reset key (`cursor`+`dir` vs `page`).
- **Projects** ([project-status-filter.tsx](../../../apps/internal/components/projects/project-status-filter.tsx) + [projects-landing.tsx](<../../../apps/internal/app/(dashboard)/projects/_components/projects-landing.tsx>) ~L127–172): bespoke multi-select popover, **client-side** filtering, URL logic living in the consumer, and the control renders above only one of the three sections it filters.

Beyond those three: **zero sort controls** anywhere (ordering hardcoded per query, coupled to keyset cursors), **zero search inputs** — though `?q=` parsing + `buildSearchCondition` already exist server-side for clients ([list-clients.ts](../../../apps/internal/lib/queries/clients/settings/list-clients.ts) ~L50), contacts ([list-contacts.ts](../../../apps/internal/lib/queries/contacts/settings/list-contacts.ts) ~L37), and projects ([listing.ts](../../../apps/internal/lib/queries/projects/listing.ts) ~L96–97) with no UI attached. The record count sits *outside* the card while filters sit *inside*; only users derives a filtered empty state.

## Design

One toolbar system, one URL-state hook, rolled out to every management table. The toolbar row (inside the table card, above the table) is **search + filters only**; sorting lives in the column headers (D6, revised):

```
[Search ⌕] [Status ▾] [Role ▾] …
┌─────────────┬──────────┬───────────┐
│ Name ↑      │ Status   │ Created   │   ← sortable columns are buttons w/ arrow
```

`SearchInput` + `FilterSelect`s, unlabeled (placeholder carries meaning, D5). The count moves into `PageShell`'s toolbar row (01) and becomes `Showing N of M` when any filter/search is active.

### `useListParams` — `hooks/use-list-params.ts`

```ts
const { filters, sort, update, hasActiveFilters } = useListParams({
  basePath: '/settings/users',
  resetKeys: ['cursor', 'dir'],          // or ['page'] for offset views
  filters: {                              // R2: filter/search keys are declared SEPARATELY from sort
    role:   { guard: isUserRole },        // no default → default = unset
    access: { guard: isUserAccess },
    q:      { guard: 'string' },
    // projects example — an IMPLICIT default that must not count as "active":
    // status: { guard: isProjectStatusList, default: ['ONBOARDING', 'ACTIVE'] },
  },
  sort: { guard: isUserSort, default: 'name:asc' },   // never contributes to hasActiveFilters
})
```

Collapses the duplicated `updateParams` closures; `update({ role })` clones `URLSearchParams`, sets/deletes, clears `resetKeys`, `router.push`es. **`hasActiveFilters` (R2):** derived from the `filters` map only — a key is active iff its guard-validated value differs from its declared (or unset) default. `sort` is excluded by construction: changing only the sort must never trigger `Showing N of M` or filtered-empty messaging. Implicit defaults (projects' clean-URL ONBOARDING+ACTIVE) normalize to inactive; explicitly choosing a *different* status set is active. Invalid values fail the guard and don't count (the PRD-003 R4 lesson). Consumed by the toolbar *and* by tables for filtered empty states.

### Components — `components/table-toolbar/`

- **`FilterBar`** — the flex wrapper (`flex flex-col gap-2 sm:flex-row sm:items-center`; search first, then filters).
- **`FilterSelect`** — `{ paramKey, placeholder, options: {value,label}[], mode?: 'single' | 'multi' }`. `single` = shadcn `Select` with the `'all'`-sentinel-→-param-removed dance; `multi` = the faceted popover lifted from `project-status-filter.tsx` (badges-in-trigger, Clear/Select all footer), serializing comma-joined. One standard trigger width token (`w-40`), ending the 160/170/180px drift.
- **`SortableTableHead`** — `{ field, children }`, rendered in place of `TableHead` for allowlisted columns only. A ghost-button header cell: click cycles `asc → desc` (→ default when the field is the view's default sort), shows `ArrowUp`/`ArrowDown` when active and a muted `ChevronsUpDown` on hover when inactive, sets `aria-sort`, writes `?sort=field:dir` via `useListParams` (clearing pagination). **The view's default-sorted column shows its arrow on first load** — sort state is always visible, with no `?sort=` param in the URL until the user changes it (PW3). Non-sortable columns render plain `TableHead` — the visual affordance difference **is** the allowlist. Lives in `components/table-toolbar/sortable-table-head.tsx` beside the toolbar (it shares `useListParams`), not in `components/ui/table.tsx`.
- **`SearchInput`** — debounced (~300ms) controlled input writing `?q=`; clears via ✕; Enter flushes immediately.

### Sort is a server concern (D6)

`?sort=field:dir` parsed against a **per-view allowlist**, feeding the existing `orderBy` arrays. The seam is `userSortExpression` — defined in [fields.ts](../../../apps/internal/lib/queries/users/fields.ts) and consumed in [settings.ts](../../../apps/internal/lib/queries/users/settings.ts) for both the `orderBy` (~L108) **and** both cursor conditions (~L61–64) — the pattern spans the two files (I1). Generalize per query: each sortable field supplies its order expression **and** its keyset cursor-condition variant (this is why the allowlist stays small: name, created, updated to start). Invalid/absent `?sort=` falls back to today's hardcoded default per view. Offset-paged views (invoices, submissions) need only the `orderBy` swap.

The control is the column header itself (`SortableTableHead`, above) — the per-field server cost is identical to any other control, and the allowlist is expressed by which columns receive the sortable affordance. Columns without a cursor variant simply stay plain `TableHead`.

**Per-sort descriptor contract (R5).** An order expression + cursor condition is not enough: keyset cursors also **encode the active sort field's value** (existing cursors carry fixed payloads like `{name, id}` — `lib/pagination/cursor.ts`), so sorting by created/updated without changing cursor *generation* compares against absent or unrelated values, producing duplicated, skipped, or empty pages. Each allowlisted sort field therefore supplies a complete descriptor:

```ts
type SortDescriptor = {
  field: string                          // 'name' | 'created' | …
  orderBy(dir: 'asc' | 'desc'): SQL[]    // includes the id tie-breaker, both directions
  encodeCursor(row): CursorPayload       // carries { <field value>, id } — typed per field
  cursorCondition(payload, dir): SQL     // comparison predicate incl. tie-breaker
  nullable?: boolean                     // if true: explicit NULLS LAST + null-aware condition
}
```

Rules: (a) the deterministic `id` tie-breaker is mandatory in both `orderBy` and the condition; (b) nullable sort columns declare an explicit null policy (`NULLS LAST`, with the condition handling the null partition); (c) cursor payloads are **tagged with their sort field** — decoding a cursor minted under a different sort (or an unknown/legacy shape) rejects and falls back to page one rather than comparing mismatched values. `useListParams` clearing the cursor on sort change is the first line of defense; the tagged-payload rejection is the server-side backstop against stale deep-linked URLs.

## Implementation / rollout order

1. **Hook + components**, converting **users** and **submissions** in the same PR (both filters already exist — pure refactor, snapshot-equal behavior). Empty-state derivation moves onto `hasActiveFilters` (users keeps parity; submissions *gains* the correct filtered message).
2. **Projects** — idiom unification: `ProjectStatusFilter` becomes `FilterSelect mode='multi'`; the URL logic in `projects-landing.tsx` ~L127–172 is deleted in favor of `useListParams`; **filtering moves server-side** into the projects listing query (status array predicate), preserving `DEFAULT_STATUS_FILTER = ['ONBOARDING','ACTIVE']` and the explicit-`none` sentinel. The FilterBar moves **above the section stack** — one control visibly governing all three sections (Client/Internal/Personal), ending today's scope mismatch where it sits above only the Client Projects table (resolved during consistency review).
3. **Search first pass** (D7): wire `SearchInput` on clients, contacts, projects (server support already live — UI-only).
4. **Remaining views**: clients, contacts, hour-blocks, invoices, leads-archive get `FilterSelect`s appropriate to their columns (status/type/billing where enums exist), `SortableTableHead` on allowlisted columns (+ cursor variants for keyset views), and `SearchInput` as search conditions are added per entity (users, invoices, hour-blocks — name/email, invoice number/client, client respectively). Note (W2): `buildSearchCondition` is **per-entity** — copies exist in `lib/queries/{clients,contacts}/settings/pagination.ts`, and projects inlines the shared primitive `createSearchPattern` (`lib/pagination/cursor.ts:73`); new entities get their own condition built on `createSearchPattern`. All search keeps the fuzzy whitespace→`%` semantics, no wildcard escaping (W3 decision).
5. **Counts**: delete the 12 bare `Total X: {n}` spans; `PageShell`'s `count` prop renders `N somethings` unfiltered / `Showing N of M` filtered (the [project-time-log-history-content.tsx](<../../../apps/internal/app/(dashboard)/projects/_components/project-time-log/project-time-log-history-content.tsx>) ~L60 pattern). Fixes submissions' double-count (range label + total span).
6. **Palette extension** (D13): `GET /api/command-palette/search` gains contacts (existing `buildSearchCondition`) and any entity whose search lands in step 4 — the palette and table search share the same server predicates by construction.

## Architecture notes

- All filtering/sorting/search is server-side after this section — the projects client-side pass (~L194–202) is the one normalization.
- Keyset invariant: any param change through `useListParams` clears the cursor — a stale cursor against a re-sorted/re-filtered set must be impossible (PRD 003 D10 lesson, now enforced centrally).
- `pagination-controls.tsx` unchanged.
- Views keep their param parsing in server pages via existing per-feature parse helpers (e.g. `parseUsersSearchParams`), extended with `q`/`sort`.

## Acceptance criteria

- [ ] Users + submissions filter behavior unchanged post-refactor (URL shape, reset semantics, counts, empty states)
- [ ] Projects: status filter is server-side, multi-select, defaults preserved, and the FilterBar sits above the section stack governing all three sections; deep-linked `?status=` URLs still work
- [ ] Search live on clients/contacts/projects (first pass) — debounced, URL-persisted, survives reload/back, resets pagination
- [ ] Every management table has sortable column headers on its allowlisted columns (arrow shows field + direction; the default-sorted column shows its arrow on first load with a clean URL (PW3); `aria-sort` set; non-sortable headers have no click affordance); sorting round-trips through the URL and works with keyset pagination in both directions; sorting resets the cursor
- [ ] Counts render in the toolbar row; `Showing N of M` appears exactly when filters/search active; no double counts
- [ ] Filtered-empty-state messages on all filtered views; invalid params ignored everywhere (type guards)
- [ ] ⌘K palette surfaces contacts (and step-4 entities) alongside clients/projects
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root

## Files

All paths under `apps/internal/`.

**New:** `hooks/use-list-params.ts` · `components/table-toolbar/{filter-bar,filter-select,sortable-table-head,search-input}.tsx`
**Modified:** the three existing filter components' consumers · list queries per view (sort allowlists, cursor variants, `buildSearchCondition` extensions) · every list page's parse helper · `lib/queries/command-palette.ts` + `app/api/command-palette/search/route.ts` (entity extension)
**Deleted:** `app/(dashboard)/settings/users/_components/users-filters.tsx` · `app/(dashboard)/submissions/_components/submissions-filters.tsx` · `components/projects/project-status-filter.tsx`
