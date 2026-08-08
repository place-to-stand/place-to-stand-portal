# PRD 004 — Implementation Progress

Update this file after each coding session. Mark items as they land; note deviations inline.

## Pre-implementation checklist

- [ ] Read [README.md](README.md) decisions D1–D16
- [ ] Read [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md) — all W#/I#/PW#/PI# findings **and the multi-reviewer R1–R7 findings** are resolved and folded into the section files; the codes there reference it
- [ ] Worktree note: fresh worktrees need `.env.local` copied and a build to generate `next-env.d.ts` (see project memory)
- [ ] Confirm implementation order: 02 → 01 → 05 → 03 → 04 (per the README dependency graph; the 05 labs land during 03/04)

## 02 — Sidebar ([02-sidebar-collapse-mobile.md](02-sidebar-collapse-mobile.md))

- [ ] `npx shadcn@latest add sidebar` (existing `hooks/use-mobile.ts` preserved)
- [ ] `components/layout/sidebar.tsx` rebuilt on primitives; visual parity when expanded
- [ ] Icon collapse + tooltips + badge dot + compact logo mark + compact `UserMenu` trigger
- [ ] `SidebarProvider` + cookie `defaultOpen` in dashboard layout; no SSR flicker
- [ ] `SidebarTrigger` in header row; `⌘B` works
- [ ] Mobile sheet drawer — all 12 nav items reachable <768px
- [ ] Active-route matching extracted to `lib/navigation/active-route.ts` (both consumers)
- [ ] Scroll model intact (body never scrolls; inner panes do)
- [ ] Build / lint / type-check pass

## 01 — Page shell + breadcrumbs + ⌘K ([01-page-shell-breadcrumbs-palette.md](01-page-shell-breadcrumbs-palette.md))

- [ ] `command.tsx` a11y fix (DialogTitle inside DialogContent)
- [ ] `breadcrumb.tsx` added; `PageShell` + `TabsNav` + `lib/navigation/breadcrumbs.ts` built
- [ ] ⌘K palette: nav entries + clients/projects record jump; ⌘K + Ctrl+K (PW2); visible header affordance w/ kbd hint (PW1); `GET /api/command-palette/search` (null→401 then assertAdmin — R1; zod-validated `q` — W5; PERSONAL-project visibility predicate — R3; client-name match + `Client · Project` labels — R7)
- [ ] Mechanical commit: all `AppShellHeader` uses → page-owned `LegacyPageHeader`; portal + shared header row deleted (server-known header ownership — R4)
- [ ] `hooks/use-record-cycle.ts` extracted; `⌘[`/`⌘]` verified on clients + project detail
- [ ] Pages converted (~22): settings/integrations · reports · submissions ×3 · hour-blocks ×3 · invoices ×4 · contacts ×3 · clients ×4 · leads ×3 · my/home · my/tasks · projects landing/archive/activity · project detail ×6
- [ ] Legacy path deleted: `AppShellHeader` portal, icon tile, 4 header components, 9 `*TabsNav` files, combobox `heading` variant
- [ ] Header height reduced; no description lines anywhere; consistent across sibling routes
- [ ] Build / lint / type-check pass

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
