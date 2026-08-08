# PRD 004 — Implementation Progress

Update this file after each coding session. Mark items as they land; note deviations inline.

## Pre-implementation checklist

- [x] Read [README.md](README.md) decisions D1–D16
- [x] Read [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md) — all W#/I#/PW#/PI# findings **and the multi-reviewer R1–R7 findings** are resolved and folded into the section files; the codes there reference it
- [x] Worktree note: fresh worktrees need `.env.local` copied and a build to generate `next-env.d.ts` (see project memory) — both present
- [x] Confirm implementation order: 02 → 01 → 05 → 03 → 04 (per the README dependency graph; the 05 labs land during 03/04)

## 02 — Sidebar ([02-sidebar-collapse-mobile.md](02-sidebar-collapse-mobile.md))

- [x] `npx shadcn@latest add sidebar` (existing `hooks/use-mobile.ts` preserved; all custom ui/ files verified byte-identical post-CLI; CLI added the unified `radix-ui` pkg for the generated file — front-runs part of 04's consolidation). Compiler fix: `SidebarMenuSkeleton` random width moved to a state initializer (react-hooks/purity)
- [x] `components/layout/sidebar.tsx` rebuilt on primitives; compact scale (`text-[12px]`/`size-3.5`/`text-[11px]` labels), active `bg-primary` styling, theme-aware logo preserved
- [x] Icon collapse + tooltips (`SidebarMenuButton tooltip`) + badge dot (collapsed) + "P" logo mark (collapsed) + compact `UserMenu` trigger (`inSidebar` prop)
- [x] `SidebarProvider` + cookie `sidebar_state` → `defaultOpen` in dashboard layout (SSR-read)
- [x] `SidebarTrigger` in header row; `⌘B`/`Ctrl+B` ships with the primitive
- [x] Mobile sheet drawer via the primitive (custom sheet's `side`/`className` API verified compatible) — browser walk in TEST-PLAN §02
- [x] Active-route matching extracted to `lib/navigation/active-route.ts` (sidebar + app-shell both consume it)
- [x] Scroll model preserved in code (`h-screen min-h-0 overflow-hidden` on provider, inner `overflow-y-auto` panes) — runtime walk in TEST-PLAN §02.9
- [x] Build / lint / type-check pass (full turbo build incl. all routes)

## 01 — Page shell + breadcrumbs + ⌘K ([01-page-shell-breadcrumbs-palette.md](01-page-shell-breadcrumbs-palette.md))

- [x] `command.tsx` a11y fix (DialogTitle moved inside DialogContent)
- [x] `breadcrumb.tsx` added; `PageShell` + `TabsNav` + `lib/navigation/breadcrumbs.ts` built. PageShell also owns the page scroll pane (main moved out of AppShell)
- [x] ⌘K palette: nav entries + clients/projects record jump; ⌘K + Ctrl+K (PW2); visible header affordance w/ kbd hint (PW1); `GET /api/command-palette/search` (null→401 then assertAdmin — R1; zod-validated `q` 2–100 — W5; PERSONAL-project visibility predicate — R3; client-name match via join + `Client · Project` labels — R7). *Deviation: "named tabs of the current section" as palette entries deferred to 06 — nav items + record jump shipped; section tabs are one click away in the toolbar*
- [x] ~~Mechanical `LegacyPageHeader` commit~~ *Deviation (R4 intent preserved): all ~22 pages converted **directly** to PageShell in this single session/branch, so no intermediate state ships and the temporary `LegacyPageHeader` scaffold was unnecessary; header ownership is server-known on every page in the final state. The portal + shared header row are deleted from `app-shell.tsx`*
- [x] `hooks/use-record-cycle.ts` extracted; mounted via `ClientRecordCycle` on client detail and directly in `projects-board.tsx` (⌘[/⌘] browser walk in TEST-PLAN)
- [x] Pages converted (26): settings/integrations · settings/users ×3 · reports/monthly-close · submissions ×3 · hour-blocks ×3 · invoices ×4 · contacts ×3 · clients ×4 · leads ×3 · my/home · my/tasks · projects landing/archive/activity · project detail (all 6 tabs via projects-board)
- [x] Legacy path deleted: `AppShellHeader` portal + header row + icon tile, `ClientsLandingHeader`, `ProjectsBoardHeader`, `ProjectsLandingHeader`, `LeadsHeader`, all 9 `*TabsNav` files, combobox `heading` variant (+ dead toolbar branch in `projects-management-section.tsx`). *Deviation: the header's `md:hidden` UserMenu was not re-homed — the §02 mobile drawer's footer UserMenu covers it*
- [x] Header height reduced (`py-2`, one line); no description lines anywhere; identical structure across sibling routes. *Note: project-detail's 6 tabs stay inside `ProjectsBoardTabsSection` (dynamic per-project hrefs), visually identical to TabsNav*
- [x] Build / lint / type-check pass (76 routes compile)

## 05 — Style guide ([05-style-guide-route.md](05-style-guide-route.md))

- [ ] `/design` route (admin-gated, not in nav); foundations + all primitives + shell specimens (initial build)
- [ ] Toolbar lab added during 03; table lab during 03/04; Base UI side-by-sides during 04
- [ ] Light/dark verified
- [ ] Build / lint / type-check pass

## 03 — Table toolbar ([03-table-toolbar-filters-sort-search.md](03-table-toolbar-filters-sort-search.md))

- [ ] `useListParams` (filters declared separately from sort; defaults-aware `hasActiveFilters` — R2) + `FilterBar`/`FilterSelect`/`SortableTableHead`/`SearchInput`
- [ ] Users + submissions converted (behavior-equal); old filter components deleted
- [ ] Projects: multi-select server-side status filter; defaults + `none` sentinel preserved
- [ ] Search: clients/contacts/projects wired; extended to users/invoices/hour-blocks
- [ ] Sort: per-sort descriptors (orderBy + field-tagged cursor encode/decode + null policy + id tie-breaker — R5) per view; sortable column headers on all management tables (`aria-sort`, cursor reset, default-sort arrow visible on load — PW3)
- [ ] Counts → toolbar row; `Showing N of M` when filtered; filtered empty states everywhere
- [ ] Palette record search extended (contacts + new entities)
- [ ] Build / lint / type-check pass

## 04 — Component refresh ([04-component-refresh-density-base-ui.md](04-component-refresh-density-base-ui.md))

- [ ] `@pts/ui` scaffolded (exports map, `cn` + `use-mobile` moved with shims, `transpilePackages`, `@source`, workspace dep); client portal NOT wired
- [ ] Radix consolidation codemod (16 → 1 `radix-ui`)
- [ ] `tabs.tsx` regenerated (h-9); `button.tsx` fixed heights incl. `lg: h-10` (W4); `skeleton.tsx` refreshed
- [ ] Table `density='compact'` variant; chrome standardized; monthly-close local classes deleted
- [ ] `components.json` → Base UI; 14 stock components migrated incl. breadcrumb (individually verified on `/design`; per-component consumer inventory + `asChild` composition contract — R6)
- [ ] Refreshed/migrated components moved into `@pts/ui` in their refresh commits; imports flipped (package = checklist)
- [ ] `confirm-dialog` rebased on alert-dialog (API unchanged, 31 importers untouched)
- [ ] `hover-card` port trial resolved (official primitive w/ tap parity, or documented keep-custom)
- [ ] Dead code deleted: `scroll-area.tsx`, `alert.tsx`, `use-board-assigned-filter.ts` (+ plumbing)
- [ ] Sheet handoff + toast dismissal regression-checked
- [ ] Build / lint / type-check pass
