# PRD 004 — Manual Test Plan

Update after each coding session. All tests run as an **ADMIN** user in the internal portal unless stated otherwise (the internal portal is admin-only; CLIENT sessions redirect to the client portal at sign-in). Sections ordered by implementation order: 02 → 01 → 05 → 03 → 04.

## Prerequisites

- [ ] Internal app running on **:3000** (`npm run dev` from repo root or `apps/internal/`)
- [ ] Seed state: ≥2 clients (with slugs) each with ≥1 project; ≥1 client with >8 projects (palette result-limit test); projects in a mix of ONBOARDING/ACTIVE/ON_HOLD/COMPLETED; ≥1 archived record per entity (client, contact, hour block, invoice, user, submission, lead); >25 users and >25 submissions (pagination × filter tests); ≥1 unacknowledged submission (sidebar badge)
- [ ] A phone-sized viewport available (device or devtools emulation, <768px)
- [ ] Both themes checked where noted (light/dark toggle in user menu)

## §02 — Sidebar: collapse + mobile (10)

- [ ] **02.1** Click the sidebar trigger → sidebar collapses to an icon rail; click again → expands. `⌘B` does the same from anywhere
- [ ] **02.2** Collapse, then hard-reload → sidebar renders collapsed **on first paint** (no expand-then-collapse flash; cookie-driven SSR)
- [ ] **02.3** Collapsed: hover each of the 12 nav items → tooltip with the item label; group labels hidden; clicking an icon navigates
- [ ] **02.4** Collapsed with ≥1 unacknowledged submission → Submissions icon shows a badge dot; expanded → numeric pill (caps at `99+`)
- [ ] **02.5** Collapsed: logo shows the compact mark; user menu opens from the square footer trigger; dev pill reduced to a dot with tooltip (dev env only)
- [ ] **02.6** Expanded: visual parity with pre-PRD — compact text scale, group labels, theme-aware logo (verify light + dark)
- [ ] **02.7** Active-item highlight correct on nested routes: `/projects/acme/site/tasks` highlights Projects; `/clients/acme` highlights Clients; `/settings/users/archive` highlights Users
- [ ] **02.8** <768px: sidebar hidden, trigger visible → opens a left sheet drawer with all 12 items; tapping one navigates AND closes the drawer; `Esc` closes; focus is trapped while open
- [ ] **02.9** Body never scrolls: long pages scroll their inner pane only, both collapsed and expanded, desktop and mobile
- [ ] **02.10** Trigger has an accessible name (inspect or screen reader); `aria-expanded`/state reflected

## §01 — Page shell, breadcrumbs, ⌘K palette (18)

- [ ] **01.1** Visit every top-level view (Home, My Tasks, Submissions, Leads board, Invoices, Hour Blocks, Projects, Clients, Contacts, Monthly Close, Users, Integrations): identical single-line header (trigger · breadcrumb · right slot) — **no description lines anywhere**, no icon tile
- [ ] **01.2** Header height is visibly reduced vs pre-PRD and **identical** across sibling navigations: `/clients` ↔ `/clients/archive` ↔ `/clients/activity`; all six project-detail tabs
- [ ] **01.3** Breadcrumbs read correctly: `/projects` → `Work / Projects`; `/clients/{slug}` → `Work / Clients / {name}`; project detail → `Work / Projects / {client · project}`; `/invoices/settings` → `Sales / Invoices / Settings`; `/my/home` → `Home`
- [ ] **01.4** Section crumbs navigate (click `Projects` in `Work / Projects / …` → landing); group segments (`Work`, `Sales`) are static non-links
- [ ] **01.5** My Tasks: person switcher present in the header right slot and functional; tabs (Board/Calendar), count, and Add task render in the toolbar row
- [ ] **01.6** Project detail: burndown widget (metrics + View/Add time-log buttons) in the header right slot on all six tabs; Edit project + status unchanged
- [ ] **01.7** Toolbar row consistent on every list view: tabs left; count + primary action right; counts/actions match the pre-PRD matrix (activity tabs keep action, no count)
- [ ] **01.8** `⌘K` **and `Ctrl+K`** open the palette from any page (PW2); typing filters nav entries; `Esc` closes; selecting navigates; no-match query shows the "No results" empty state (PI1)
- [ ] **01.8b** The header row shows a visible search affordance with a `⌘K` hint; clicking it opens the palette (PW1)
- [ ] **01.9** Palette: type ≥2 chars of a client name → client appears under Clients → selecting lands on `/clients/{slug}`; same for a project → `/projects/{clientSlug}/{projectSlug}/tasks`; **typing a client's name also surfaces that client's projects** with `Client · Project` labels (R7)
- [ ] **01.9b** Two-admin check: admin A's PERSONAL project never appears in admin B's palette results (R3); own PERSONAL projects do appear
- [ ] **01.10** Palette: >8 matches → results capped at 8 per group; 1 char → no record fetch; nonsense query → nav items filter to none, no error
- [ ] **01.11** `⌘[` / `⌘]` still cycle prev/next records on `/clients/{slug}` and project detail; disabled at list ends as before
- [ ] **01.12** Board-height pages (My Tasks board, leads board, project board) still fill the viewport with internal scrolling — no double scrollbars
- [ ] **01.13** No Radix `DialogTitle` warning in the console when opening the palette; palette announces its title to AT
- [ ] **01.14** `GET /api/command-palette/search?q=…` unauthenticated → **401 exactly** (explicit null check before assertAdmin — R1); (if testable) CLIENT-role session → 403
- [x] **01.15** Old header components gone: no `text-3xl` combobox titles on `/clients` or project detail; global grep finds zero `AppShellHeader` usages at section end <!-- auto-verified: grep + deleted files -->
- [ ] **01.16** Mobile (<768px): header wraps gracefully; breadcrumb truncates (no horizontal scroll); user menu reachable

**Edge cases:**
- [ ] **01.E1** Deep-link an invalid client slug → existing 404/redirect behavior unchanged (breadcrumb doesn't crash on missing record)
- [ ] **01.E2** Palette search with a `%`/`_` in the query → no error/500; results may broaden (fuzzy `createSearchPattern` semantics are intentional — W3 decision); a >100-char query is rejected cleanly by validation (W5)
- [ ] **01.E3** `⌘K` while the palette is open → closes (toggle), no stacking
- [ ] **01.E4** Mid-migration state (some pages on `LegacyPageHeader`, some on `PageShell`): an unconverted page's header is present in the server-rendered HTML (view-source), no header pop-in or layout shift on load (R4)

## §05 — Style guide `/design` (6)

- [ ] **05.1** `/design` renders for an admin; signed-out → redirected to sign-in; the route appears nowhere in the sidebar nav
- [ ] **05.2** Initial build: foundations (tokens/radius/type/entity colors), every UI component with all variants × sizes × states, shell specimens (TabsNav, breadcrumb 1/2/3 segments, toolbar row)
- [ ] **05.3** Light + dark: all specimens legible in both themes; token swatches show both values
- [ ] **05.4** Buttons section shows `xs`/`sm`/`default`/`icon-sm`/`icon`/`icon-lg`; sheet section opens all 5 sizes; toasts fire from trigger buttons
- [ ] **05.5** (By end of 03) Toolbar lab: FilterBar with single + multi FilterSelect and SearchInput, local-state wired; SortableTableHead states visible in the table lab
- [ ] **05.6** (By end of 04) Table lab shows `default` vs `compact` side by side with the standardized chrome; Base UI side-by-side blocks removed once migrations land

## §03 — Table toolbar: filters, sort, search (16)

- [ ] **03.1** Users: role + access filters behave exactly as pre-PRD (URL `?role=&access=`, archive tab role-only, count follows, cursor cleared on change, filters survive pagination)
- [ ] **03.2** Submissions: unack/kind/status filters behave as pre-PRD on both tabs; `page` resets on filter change
- [ ] **03.3** Projects: status FilterBar sits **above the section stack**; changing it filters Client AND Internal AND Personal sections; defaults to ONBOARDING+ACTIVE with a clean URL; Clear → `?status=none` sentinel; deep-linked `?status=` URLs work; filtering now happens server-side (network tab shows refetch)
- [ ] **03.4** Search (clients, contacts, projects): typing debounces (~300ms) then updates URL `?q=` and results; ✕ clears; Enter flushes immediately; survives reload and back/forward; resets pagination
- [ ] **03.5** Search extended: users (name/email), invoices (number/client), hour blocks (client) — same behaviors
- [ ] **03.6** Sort: on each management table, allowlisted column headers show the sort affordance; click → `asc` with ↑, click again → `desc` with ↓, again → default order; URL carries `?sort=field:dir`
- [ ] **03.6b** On first load (no `?sort=`), the default-sorted column already shows its direction arrow (PW3); cycling back to default clears the URL param but keeps the arrow
- [ ] **03.7** Sort × keyset pagination: sort by name on users, paginate forward AND backward → order stable, no skipped/duplicated rows; changing sort resets the cursor
- [ ] **03.7b** Sort by created/updated with duplicate timestamp values across a page boundary → no duplicated or skipped rows (id tie-breaker, R5); a nullable sort column places nulls last consistently in both directions
- [ ] **03.8** Non-sortable headers: no button affordance, no cursor change, clicking does nothing
- [ ] **03.9** `aria-sort` present on the active sorted header (inspect)
- [ ] **03.10** Counts: unfiltered → `N <things>`; any filter/search active → `Showing N of M`; submissions no longer double-renders its total
- [ ] **03.11** Filtered empty state: apply a filter matching nothing on every filtered view → "no matches" message (not the default empty state); clear → default state returns
- [ ] **03.12** Invalid params ignored: `?role=SUPERADMIN`, `?sort=evil:asc`, `?status=BOGUS` → treated as unset, no active-filter styling, no crash
- [ ] **03.13** ⌘K palette now surfaces contacts (and step-4 entities) alongside clients/projects
- [ ] **03.14** Old filter components deleted; leads archive gets its FilterSelects; no view lost a pre-PRD filter capability

**Edge cases:**
- [ ] **03.E1** Combine search + filter + sort + pagination on one view (users) → all four round-trip through the URL together; reload reproduces the exact view
- [ ] **03.E2** Filter change while on page N of results → returns to first page (no stale-cursor 500/empty)
- [ ] **03.E3** Rapid typing then immediate navigation away → no state bleed into the next view
- [ ] **03.E4** Deep-link a URL pairing a cursor minted under one sort with a different `?sort=` (stale bookmark) → server rejects the mismatched cursor payload and serves page one; no 500, no garbage page (R5)
- [ ] **03.E5** Change only the sort on a filtered-capable view → count stays `N <things>` (no `Showing N of M`), no filtered-empty message (R2); projects with the clean-URL default status → not treated as filtered

## §04 — Component refresh, `@pts/ui`, Base UI (12)

- [ ] **04.1** After Radix consolidation: `package.json` has one `radix-ui` dep, zero `@radix-ui/react-*`; app builds; spot-check dialog/select/dropdown/tooltip behavior unchanged
- [ ] **04.2** Tabs everywhere render `h-9` (TabsNav, sheet-embedded tabs, settings); hover affordance retained
- [ ] **04.3** Buttons: default 36px / sm 32px / xs 28px / lg 40px exact (W4; inspect); icon buttons square at each size; no wrapped-label breakage on the style guide or dense toolbars
- [ ] **04.4** Management tables render `density='compact'`; row height visibly reduced (icon-sm actions); one header treatment (`bg-muted/40`) and one radius (`rounded-lg`) across management tables, review tab, invoice settings (which gains the header fill), monthly close
- [ ] **04.5** Monthly close renders identically to its pre-PRD custom classes (promoted variant), and its local `tableClasses` are gone
- [ ] **04.6** Each of the 14 Base UI migrations: component renders identically on `/design` (light+dark), primary consumer flow works (e.g. dialog open/close/esc/overlay, select keyboard nav, switch `sm`)
- [ ] **04.6b** Port-specific deltas (from the migration's own notes): selects app-wide show the selected label/badge in the trigger and the popup width matches the trigger; long selects' scroll arrows render correctly; user-menu theme toggle keeps the menu open while Edit profile/Sign out close it; searchable-combobox width/max-height/scroll containment intact; popovers/menus near viewport edges may sit ~5px differently (Base collisionPadding default) — acceptable; AlertDialog/ConfirmDialog: Esc closes, outside-click doesn't, action buttons close + run handlers; tooltip arrow renders as a primary diamond (approximation of the Radix triangle) — flag if it reads wrong
- [ ] **04.7** Sheet regression: task sheet create→edit stays open with **no** mount flicker (`skipMountAnimation` handoff); clicking a toast while a sheet is open does not dismiss the sheet
- [ ] **04.8** `confirm-dialog`: spot-check several of the 31 consumers (archive client, delete time log, etc.) — open/confirm/cancel unchanged; outside-click no longer dismisses; `Esc` cancels
- [ ] **04.9** `hover-card` trial outcome verified: if ported — clients table total-projects hover opens on hover AND tap, delays feel unchanged, controlled-mode consumer works; if kept — documented in PROGRESS, behavior untouched
- [ ] **04.10** `@pts/ui`: every refreshed component imports from `@pts/ui/*` (grep); `turbo build`/`type-check` cover the package; `apps/client/` has no `@pts/ui` dependency and its five copies are untouched
- [ ] **04.11** Dead code gone: `scroll-area.tsx`, `alert.tsx`, `use-board-assigned-filter.ts` deleted; project board drag/drop/filtering unaffected
- [ ] **04.12** Full-app smoke after section completion: create/edit a task, log time, archive/restore a record, send nothing — no console errors on the main flows

**Edge cases:**
- [ ] **04.E1** Theme toggle rapidly while `/design` open → no unstyled flash in migrated components
- [ ] **04.E2** Keyboard-only pass on one migrated dialog + select + dropdown → focus trap, arrow nav, `Esc` all correct (Base UI parity)

## Cross-section regression (after all sections)

- [x] **X.1** `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root <!-- auto-verified: all three green, 77 routes -->
- [ ] **X.2** PRD 003 flows intact: task sheet stays open on save; task-sheet time logging; users filters (now via the new toolbar) still role+access capable
- [ ] **X.3** Every route in the README route matrix loads without console errors, light + dark, desktop + mobile viewport
