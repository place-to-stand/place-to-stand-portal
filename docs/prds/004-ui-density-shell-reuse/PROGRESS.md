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

- [x] `/design` route (admin-gated via dashboard layout, not in nav); foundations (31 tokens, radius/type scales, entity colors) + all primitives (buttons/forms/overlays/display across 5 files) + shell specimens
- [x] Toolbar lab (FilterBar/FilterSelect single+multi/SearchInput, local-state) + table lab (default vs compact side-by-side, SortableTableHead cycle, filtered empty state). Base UI side-by-sides n/a — migration deferred (see §04)
- [ ] Light/dark verified <!-- MANUAL STEP for the user: open /design in both themes (TEST-PLAN §05.3) — browser session required -->
- [x] Build / lint / type-check pass

## 03 — Table toolbar ([03-table-toolbar-filters-sort-search.md](03-table-toolbar-filters-sort-search.md))

- [x] `useListParams` (filters declared separately from sort; defaults-aware `hasActiveFilters` — R2) + `FilterBar`/`FilterSelect`(single+multi)/`SortableTableHead`/`SearchInput` in `components/table-toolbar/`
- [x] Users + submissions converted (behavior-equal URL semantics; users gained search); old `users-filters`/`submissions-filters` rebuilt on the shared system, `project-status-filter.tsx` deleted
- [x] Projects: multi-select **server-side** status filter above the section stack; defaults + `none` sentinel + clean-URL-until-interaction preserved; landing search (name/slug/client name); count suppresses `Showing N of M` on the implicit default (R2/03.E5)
- [x] Search: clients (landing + archive)/contacts/projects wired; extended to users (name/email), invoices (number/client), hour-blocks (client — incl. a latent missing-join count bug fixed)
- [x] Sort: R5 descriptors (field-tagged cursors, effectiveAsc, id tie-breaker; invoices `number` declares NULLS LAST) on users/clients/contacts/hour-blocks keyset paths; offset views (submissions/invoices/hour-blocks pages, leads-archive in-memory) via orderBy swap; `SortableTableHead` on every allowlisted column (`aria-sort`, cursor/page reset, default arrow on load — PW3). *Note: clients/contacts tables have no Created column, so `created` is deep-link-only there*
- [x] Counts → PageShell (`Showing N of M` exactly when filtered); filtered empty states on every filtered view (guard-validated, R4-lesson)
- [x] Palette record search extended: Contacts group (name/email → `/contacts?q=`, no detail route exists)
- [x] Build / lint / type-check pass

## 04 — Component refresh ([04-component-refresh-density-base-ui.md](04-component-refresh-density-base-ui.md))

- [x] `@pts/ui` scaffolded (per-component source exports matching `@pts/db` convention, own `components.json`, `cn` + `use-mobile` moved with re-export shims, `transpilePackages`, `@source` in globals.css, workspace dep); client portal NOT wired; turbo type-checks the package
- [x] Radix consolidation (16 `@radix-ui/react-*` → 1 `radix-ui` via `shadcn migrate radix`; tiptap primitives' two direct imports rewritten; deps pruned)
- [x] `tabs.tsx` regenerated (h-9, v4 pattern, hover affordance kept); `button.tsx` fixed heights `h-9/h-8/h-7/h-10` incl. `lg` (W4); `skeleton.tsx` refreshed (bg-accent)
- [x] Table `density='compact'` variant (context-based); chrome standardized (one `bg-muted/40` header, `rounded-lg` containers, compact on all management tables + review tab + invoice settings + monthly close; `tableClasses` deleted; one justified exception: monthly-close `first:pl-5 last:pr-5` gutter for card alignment)
- [x] Base UI migration done (user-ordered, deferral overridden): all 14 components ported to `@base-ui/react@1.7` — **primitive-swap under our exact New York classes/APIs**, NOT shadcn's restyled `base-nova` wrappers (no visually-identical base style exists in the registry; adopting base-nova would have violated the zero-visual-regression contract). R6 honored in code: consumer inventory ran (34 `asChild` call sites across 5 trigger types, zero dropdown checkbox/radio/sub usage), every wrapper preserves its public API via adapters — `asChild`→`render`, `forceMount`→`keepMounted`, `onSelect`→`onClick`+`preventBaseUIHandler` (Radix keep-open contract), Radix CSS-var aliases (`--radix-*` → Base `--anchor-width`/`--available-height`/`--transform-origin`), select JSX-walk `items` map for trigger label resolution, method-syntax bivariant `onValueChange`. **Zero consumer files edited; zero components reverted.** `components.json` → `base-nova` (future `shadcn add`s arrive base-styled and need a look-pass). Keyboard/focus browser walk: TEST-PLAN 04.6/04.6b/04.E2. **UF1 (post-impl fix):** Base UI's runtime context invariants crashed the app (GroupLabel outside Group via forceMount SSR) — label wrappers rebuilt as plain divs, full invariant sweep run, and `scripts/smoke-render-ui.tsx` added as the SSR regression harness (21 compositions, all passing)
- [x] Refreshed/migrated components moved into `@pts/ui`: `button`, `tabs`, `skeleton`, `table`, `confirm-dialog` + the 14 Base UI components (`alert-dialog`, `avatar`, `breadcrumb`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `label`, `popover`, `progress`, `select`, `separator`, `switch`, `tooltip`) + `cn`, `use-mobile`; 180 files' imports flipped across two waves (package = checklist). `components/ui/` now holds only the deliberately-kept set: bespoke composites (searchable-combobox, pagination-controls, disabled-field-tooltip, phone-input, toast system, rich-text-editor), stay-Radix (`sheet`, `form`, `sidebar`, `hover-card`), cmdk `command`, and plain-HTML `input`/`textarea`/`badge`/`card`
- [x] `confirm-dialog` rebased on alert-dialog primitives (API unchanged — 31 importers untouched; outside-click no longer dismisses; `showCloseButton` kept as a documented no-op)
- [x] `hover-card` port trial resolved: **keep custom** — the trial's tap-to-open parity gate (touch behavior) is unverifiable without a browser session, and the spec's fail-safe is keeping the popover-based custom build. Revisit alongside the deferred Base UI step (06)
- [x] Dead code deleted: `scroll-area.tsx`, `alert.tsx`, `use-board-assigned-filter.ts` + `board-filters.ts` + all plumbing through core/derived board state
- [ ] Sheet handoff + toast dismissal regression-checked <!-- MANUAL STEP for the user: TEST-PLAN §04.7 browser walk (sheet.tsx itself was NOT modified this session — its imports were consolidated to the radix-ui package only) -->
- [x] Build / lint / type-check pass (77 routes)
