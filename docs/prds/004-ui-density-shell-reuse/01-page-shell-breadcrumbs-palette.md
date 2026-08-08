# 01 — Page Shell, Breadcrumb Header, ⌘K Palette

**Depends on:** 02 (sidebar — supplies `SidebarTrigger` and the shadcn `SidebarProvider` shell)
**App:** `apps/internal/`
**Decisions:** D1, D2, D3, D10, D11, D13, D14 (see [README.md](README.md))
**Review codes:** W1, W2, W3, W5, I3, I5, PW1, PW2, PI1 (see [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

## Problem

There is no page shell. [app-shell.tsx](../../../apps/internal/components/layout/app-shell.tsx) renders one chrome bar (`px-4 py-4`, icon tile + portal slot) and every page pushes arbitrary JSX into it via the `AppShellHeader` context portal (~35 importers). Consequences:

- The `h1(text-2xl) + p(text-sm)` title block is copy-pasted into **~22 files**; the description line is filler on all of them (D1).
- `/clients`, `/projects`, and the 6 project-detail routes instead render `SearchableCombobox variant='heading'` at **`text-3xl`** with no description ([searchable-combobox.tsx](../../../apps/internal/components/ui/searchable-combobox.tsx) ~L191–195, L216–220) — the header bar visibly changes height between sibling pages.
- The tabs/count/action row idiom is copy-pasted ~12×, and **nine near-identical `*TabsNav` components** exist (clients, contacts, hour-blocks, invoices, leads, projects, users, submissions, projects-board), all with the same literal `TabsList` classes.
- The header icon is derived by re-matching the pathname against `NAV_GROUPS` (app-shell.tsx ~L73–89) — logic duplicated verbatim from `sidebar.tsx` — and silently renders nothing for uncovered routes.
- No breadcrumbs exist anywhere; `⌘[`/`⌘]` prev/next-record navigation lives *inside* the combobox header components ([clients-landing-header.tsx](<../../../apps/internal/app/(dashboard)/clients/_components/clients-landing-header.tsx>) ~L51–68, [projects-board-header.tsx](<../../../apps/internal/app/(dashboard)/projects/_components/projects-board-header.tsx>) ~L34–49).
- No global quick-nav exists; `command.tsx` (`CommandDialog`) is installed but unused — and has an a11y bug (see implementation step 1).

## Design

Three layout components in `apps/internal/components/layout/`, one palette, one shadcn add:

```
<PageShell
  breadcrumbs={[{ label: 'Work', href: undefined }, { label: 'Projects', href: '/projects' }, { label: project.name }]}
  headerRight={<ProjectBurndownWidget … />}     // optional slot (D3)
  tabs={PROJECT_TABS} activeTab='tasks'          // optional
  count={{ label: 'projects', total: 42 }}       // optional; 03 upgrades to Showing N of M
  primaryAction={<ProjectsAddButton />}          // optional
>
  {children}
</PageShell>
```

- **Header row** (one line, ~half current height): `SidebarTrigger` (from 02) · `<Breadcrumb>` · spacer · `headerRight` slot · mobile `UserMenu`. Container drops `py-4` → `py-2`; breadcrumb at `text-sm`, final segment `text-foreground font-medium`, parents `text-muted-foreground` links (D2). The icon tile and description line are **deleted** (D1).
- **Toolbar row** below the header (rendered only when `tabs`/`count`/`primaryAction` present): left `TabsNav`, right count + action — replacing the copy-pasted flex idiom.
- **`TabsNav`** (new, one component): takes `{ tabs: { value, label, href }[]; activeTab }`, renders the existing visual (`bg-muted/40 … rounded-lg p-1` — density-refreshed in 04). The nine `*TabsNav` components are deleted; their `TABS` arrays move to colocated `_lib/tabs.ts` config files per feature (D11).

### Breadcrumb source of truth

`lib/navigation/breadcrumbs.ts`: `crumbsForNav(href)` derives `Group / Section` from [navigation-config.ts](../../../apps/internal/components/layout/navigation-config.ts) (e.g. `/projects` → `Work / Projects`). Pages pass `breadcrumbs` explicitly to `PageShell`, using the helper for the static prefix and appending record segments themselves (`Work / Projects / GFNC · Marketing Site`). Explicit-prop beats route-magic: record names come from page data, and odd routes (`/invoices/settings` → `Sales / Invoices / Settings`) stay obvious. This also fixes the `/invoices/settings` mislabeled-title problem.

Group crumbs (`Work`) have no href (not navigable — no landing pages exist); section crumbs link; the last crumb is plain text.

### ⌘K command palette (D13)

`components/layout/command-palette.tsx`, mounted once inside `AppShell`, opened via `⌘K` **and `Ctrl+K`** (`metaKey || ctrlKey`, matching the existing `⌘[`/`⌘]` handlers — PW2; no conflict: sidebar uses `⌘B`) **and a visible search affordance in the `PageShell` header row** — a muted search button showing a `⌘K` kbd hint; it replaces a visible control, so the visible entry point is part of the contract, not optional chrome (PW1).

- **Navigate group** — static, from `NAV_GROUPS`: all 12 nav items + named tabs of the current section. Selecting `router.push`es.
- **Clients / Projects groups** — record jump. Debounced (~200ms) fetch to the new route below once the query is ≥2 chars; clients navigate to `/clients/[clientSlug]`, projects to `/projects/[clientSlug]/[projectSlug]/tasks`. These two ship **in this section** because it retires their combobox headers (D13). Empty state: `CommandEmpty` renders "No results for '…'" (PI1).
- New route `GET /api/command-palette/search?q=` — `getCurrentUser()` + `assertAdmin()`, then **zod-parse `q` (trim, 2–100 chars) before querying** (W5, matching the `api/tasks/` route convention), then parallel `Promise.all` of two small queries reusing the existing search predicates — `buildSearchCondition` in [pagination.ts](../../../apps/internal/lib/queries/clients/settings/pagination.ts) for clients, and the `createSearchPattern` (`lib/pagination/cursor.ts:73`) condition inlined in [listing.ts](../../../apps/internal/lib/queries/projects/listing.ts) ~L86–97 for projects (W2 — there is no single shared helper) — with `limit 8` each, returning `{ ok, data: { clients: [...], projects: [...] } }` (I3: `{ok,data}` per CLAUDE.md; consistent within this new namespace). Search inherits the fuzzy `%`-join semantics of `createSearchPattern` by design (W3 decision — no wildcard escaping). Section 03 extends this route with more entities.

### `⌘[` / `⌘]` extraction (D14)

New hook `hooks/use-record-cycle.ts`: `useRecordCycle({ onPrevious, onNext, canPrevious, canNext })` — the keydown listener currently embedded in `clients-landing-header.tsx` and `projects-board-header.tsx`, verbatim. The clients and projects detail pages mount it directly; the two header components (and `ProjectsLandingHeader`, `LeadsHeader`) are then **deleted** along with the `heading` variant branch of `searchable-combobox.tsx`.

## Implementation

### 1. Prerequisite: fix `command.tsx`

In [command.tsx](../../../apps/internal/components/ui/command.tsx), `CommandDialog` renders the `sr-only` `DialogHeader`/`DialogTitle`/`DialogDescription` as a **sibling of `DialogContent`, outside it** — Radix requires `Dialog.Title` inside `Dialog.Content`; as-is the dialog is unlabeled and warns. Move the header inside `DialogContent` (match current upstream shadcn). Pulled forward from section 04 because the palette makes this component load-bearing.

### 2. Build `PageShell` + `TabsNav` + breadcrumb

- `npx shadcn@latest add breadcrumb` → `components/ui/breadcrumb.tsx`.
- `components/layout/page-shell.tsx` as designed above. It does **not** use the `AppShellHeader` portal — it renders the header row itself as the first child of the content column; `AppShell` keeps the portal alive for unconverted pages during migration (both header paths must not render simultaneously — `AppShell` renders its legacy header row only when the portal has content).
- `components/layout/tabs-nav.tsx` — lift the markup from [clients-tabs-nav.tsx](<../../../apps/internal/app/(dashboard)/clients/_components/clients-tabs-nav.tsx>) (~L41–45); navigation via `router.push(tab.href)` as today.
- `lib/navigation/breadcrumbs.ts` + extract the duplicated route-match logic (`sidebar.tsx` ~L79–89 / `app-shell.tsx` ~L74–87) into `lib/navigation/active-route.ts` — single source, both consumers import it (02 may land this first; coordinate).

### 3. Build the palette + search route

As designed. Files: `components/layout/command-palette.tsx`, `app/api/command-palette/search/route.ts`, small `lib/queries/command-palette.ts` for the two search queries. Standard response envelope; errors mapped per `lib/errors/http.ts` convention.

### 4. Convert pages, route-group by route-group

Order (simple → complex): settings/integrations → reports → submissions → hour-blocks → invoices → contacts → clients → leads → my (home, tasks) → projects (landing + detail). Per page: delete the `AppShellHeader` block + hand-rolled toolbar row, wrap content in `PageShell` with props, delete the local `*TabsNav`.

Special cases:
- **My Tasks** ([my-tasks-page.tsx](../../../apps/internal/components/my-tasks/my-tasks-page.tsx)): `headerRight={<PersonSelector …>}` (D3); its inline tabs (~L296–314) move to the `tabs` prop; count + Add task to `count`/`primaryAction`.
- **Project detail** ([projects-board.tsx](<../../../apps/internal/app/(dashboard)/projects/projects-board.tsx>) — note: lives at the route root, **not** `_components/` (W1)): `headerRight={<ProjectBurndownWidget …>}` (D3); breadcrumb ends with the project name; the two divergent `AppShellHeader` branches (L132, L159) collapse into one `PageShell` usage. Combobox header replaced; `useRecordCycle` mounted with the existing prev/next handlers.
- **Clients landing/detail**: same treatment; `/clients/[clientSlug]` breadcrumb `Work / Clients / {name}`.
- **Home** ([home-dashboard.tsx](../../../apps/internal/components/dashboard/home-dashboard.tsx)): breadcrumb is just `Home` — single-crumb pages render fine.
- **Board-height pages** (my-tasks, leads board, project board): `PageShell` accepts `contentClassName` so the three existing full-height root wrappers unify to one (`flex h-full min-h-0 flex-col`).

### 5. Delete the legacy path

When the last page converts: remove `HeaderContext`/`AppShellHeader`/`useAppShellHeader` from `app-shell.tsx`, the legacy header row, the icon tile, `ClientsLandingHeader`, `ProjectsBoardHeader`, `ProjectsLandingHeader`, `LeadsHeader`, the `heading` variant of `searchable-combobox.tsx`, and the nine `*TabsNav` files.

## Architecture notes

- `PageShell` is a client component (tabs/palette interactivity) but takes serializable props — server pages can render it directly.
- Migration is incremental and shippable at any intermediate point; the legacy portal and `PageShell` coexist until step 5.
- The description strings are deleted, not relocated (D1). Any genuinely load-bearing copy (none found in audit) would move into page content.

## Acceptance criteria

- [ ] Every dashboard route renders the same single-line header: trigger · breadcrumb · optional right slot; no description lines remain; header height visibly reduced (~py-2)
- [ ] Header height identical across sibling navigations (`/clients` ↔ `/clients/archive`; project tabs)
- [ ] Breadcrumb parents navigate; `/invoices/settings` reads `Sales / Invoices / Settings`
- [ ] My Tasks keeps its person switcher, project detail keeps the burndown widget, in the header right slot
- [ ] Tabs/count/action row identical across all list views; nine `*TabsNav` files deleted
- [ ] ⌘K **and Ctrl+K** open the palette anywhere; typing filters nav items; ≥2 chars surfaces matching clients + projects; selection navigates; `Esc` closes; empty state shows "No results" (PW2, PI1)
- [ ] A visible search affordance with a `⌘K` hint sits in the header row and opens the palette on click (PW1)
- [ ] Palette API rejects non-admin sessions and zod-validates `q` (W5)
- [ ] `⌘[`/`⌘]` still cycle records on clients and project detail pages
- [ ] No Radix `DialogTitle` warning from the palette
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root

## Files

All paths under `apps/internal/` unless noted.

**New:** `components/ui/breadcrumb.tsx` · `components/layout/page-shell.tsx` · `components/layout/tabs-nav.tsx` · `components/layout/command-palette.tsx` · `lib/navigation/breadcrumbs.ts` · `lib/navigation/active-route.ts` · `hooks/use-record-cycle.ts` · `app/api/command-palette/search/route.ts` · `lib/queries/command-palette.ts` · per-feature `_lib/tabs.ts` configs

**Modified:** `components/layout/app-shell.tsx` (portal removal at end) · every `app/(dashboard)/**` page with a header (~22) · `components/ui/command.tsx` (a11y fix) · `components/ui/searchable-combobox.tsx` (heading variant removed)

**Deleted:** `app/(dashboard)/clients/_components/clients-landing-header.tsx` · `app/(dashboard)/projects/_components/projects-board-header.tsx` · `app/(dashboard)/projects/_components/projects-landing-header.tsx` · `app/(dashboard)/leads/_components/leads-header.tsx` · nine `*-tabs-nav.tsx` files
