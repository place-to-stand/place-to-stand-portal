# 04 — Component Refresh: `@pts/ui` Package, Density Corrections, Radix Consolidation, Base UI

**Depends on:** 05 (the style guide is the acceptance surface — every change here is verified on `/design`) and 03 (the table-chrome standardization in step 2 applies to the toolbars/tables 03 converts; steps 0–1 can start any time after 05)
**App:** `apps/internal/` + new `packages/ui/`
**Decisions:** D8, D10, D15, D16 (see [README.md](README.md))
**Review codes:** W4, I2, PI3, R6 (see [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

## Problem

`components/ui/` (38 files) sits at stock shadcn "new-york" density with a few divergences — some deliberate and worth keeping, some stale:

- [button.tsx](../../../apps/internal/components/ui/button.tsx) (**73 importers**): fixed heights removed in favor of padding — buttons run ~2px *taller* than shadcn spec (`default` ~38px vs 36, `sm` ~34 vs 32). The custom `xs`/`icon-sm`/`icon-lg` sizes are good and load-bearing.
- [tabs.tsx](../../../apps/internal/components/ui/tabs.tsx) (**20 importers**): stale pre-v4 shadcn — `forwardRef` pattern, `TabsList h-10 p-1` vs current `h-9 p-[3px]`, triggers `px-3 py-1.5` vs `px-2 py-1`. Keep the added hover affordance + `cursor-pointer`.
- [skeleton.tsx](../../../apps/internal/components/ui/skeleton.tsx): stale (`bg-muted`, no `data-slot`).
- Table styling has **four competing header treatments** (`bg-muted/40` default · review tab `bg-muted/30 text-xs uppercase py-3` · monthly-close `bg-muted/50 h-8 text-[10px] first:pl-5` · invoice-settings unstyled) and two container radii (`rounded-xl` vs `rounded-lg`).
- Radix is installed as **16 individual `@radix-ui/react-*` packages** — the layout deprecated Feb 2026 in favor of the unified `radix-ui` package. No Base UI anywhere; shadcn made Base UI the default July 2026.
- Dead code: `scroll-area.tsx`, `alert.tsx` (0 importers each); `lib/projects/board/state/use-board-assigned-filter.ts` (167 lines, plumbed through board state, never rendered by any control).

## Implementation

Ordered so each step is independently shippable and verified on `/design`.

### 0. Scaffold `packages/ui` (`@pts/ui`) (D15)

shadcn's documented monorepo layout, matching the existing `@pts/db`/`@pts/github` conventions:

- `packages/ui/` with `package.json` (`"name": "@pts/ui"`, exports map per-component: `"./button"`, `"./cn"`, …), `tsconfig.json` extending `tsconfig.base.json`, and its own `components.json` (the shadcn CLI monorepo pattern — future `shadcn add` targets the package).
- `cn` moves into the package (`@pts/ui/cn`); `apps/internal/lib/utils.ts` re-exports it during migration so existing imports keep working. Shared UI hooks (`use-mobile`) move likewise.
- Internal app wiring: `transpilePackages: ['@pts/ui']` in [next.config.ts](../../../apps/internal/next.config.ts); Tailwind v4 `@source '../../../packages/ui/src'` in `globals.css` so the package's classes are scanned; `@pts/ui` workspace dep in `apps/internal/package.json`.
- **Migration rule (the checklist property):** a component moves `components/ui/x.tsx` → `packages/ui/src/x.tsx` **in the same commit that refreshes/migrates it** (steps 2–3 below), and all its internal-app imports flip to `@pts/ui/x`. `@/components/ui/*` = not yet done; `@pts/ui/*` = done. No half-moved components; `components/ui/` is empty (or reduced to the deliberately-unported bespoke set) when this section completes.
- The client portal does **not** import `@pts/ui` in this PRD (D12/D15); its five copies are untouched. **Guardrail (PI3): while `@pts/ui` exists unadopted by the client portal, no *new* component copies land in `apps/client/components/ui/`** — the drift is frozen at five until adoption (see [06-future-scope.md](06-future-scope.md)).

### 1. Radix consolidation (mechanical, first)

Run the official codemod (`npx shadcn@latest migrate radix`): rewrites `@radix-ui/react-*` imports to the unified `radix-ui` package; update `package.json` (16 deps → 1). Include the two direct imports in `components/tiptap-ui-primitive/{dropdown-menu,popover}`. Zero behavior change expected; full build + type-check + smoke.

### 2. Density corrections (D10)

- **`tabs.tsx`** → regenerate from current shadcn (`h-9 p-[3px]`, `px-2 py-1` triggers, function/`data-slot` pattern), re-apply the hover/cursor customizations. 20 importers get denser for free; visually verify the `TabsNav` (01) and sheet-embedded tabs.
- **`button.tsx`** → restore fixed heights: `default: h-9`, `sm: h-8`, `lg: h-10` (W4 — `lg` is height-less today too), keep `xs` (add `h-7` for determinism), keep `icon-sm`/`icon-lg`, keep the shadow removals. Tightens every table row with a `size='icon'` actions cell (~52px → ~48px). Audit the handful of buttons relying on padding-derived height for multi-line content.
- **`skeleton.tsx`** → regenerate (v4).
- **Table density variant** in [table.tsx](../../../apps/internal/components/ui/table.tsx): `density?: 'default' | 'compact'` via context from `<Table>` — compact = `TableHead h-8 text-xs` + `TableCell py-1.5 px-2`. Promote the monthly-close `tableClasses` experiment ([section-shell.tsx](<../../../apps/internal/app/(dashboard)/reports/monthly-close/_components/section-shell.tsx>) ~L223–237) into this variant and delete the local copy.
- **Standardize table chrome**: one header treatment (`bg-muted/40`, per current majority), one container (`rounded-lg border` — the smaller radius, denser), applied across management tables, review tab, invoice settings (which gains the missing header fill), monthly close. Apply `density='compact'` to the management tables; review + monthly-close keep compact and lose their local overrides.

### 3. Base UI, gradual (D8)

- Set `components.json` → Base UI (`--base`); registry adds/regenerations now emit Base UI variants.
- **Migrate now** (stock, unmodified — regenerate and diff), **14 components**: `alert-dialog`, `avatar`, `breadcrumb` (added in 01, stock), `checkbox`, `collapsible`, `dialog` (re-apply `showCloseButton`), `dropdown-menu`, `label`, `popover`, `progress`, `select` (re-apply the two small deltas), `separator`, `switch` (re-apply `sm` size), `tooltip`. Per-component PR-sized commits, each verified on `/design` + primary consumers.
- **Composition contract per migration (R6):** "stock component" does NOT mean "import-only flip" — Base UI's composition model differs from Radix (render-prop instead of `asChild`), and the repo has many `asChild` trigger consumers (`PopoverTrigger`, `DropdownMenuTrigger`, `TooltipTrigger`, `AlertDialogTrigger`, …). Each migration commit must: (1) inventory that component's consumers first (grep its exports); (2) either have the regenerated wrapper **preserve the current public API** — including `asChild`-style composition, prop names, and event/focus behavior — or include every affected call-site change in the same commit; (3) verify keyboard/focus behavior on `/design` and the primary consumer, not just visuals. If a wrapper can't cheaply preserve the API, that component moves to the stay-Radix list instead — API-preserving wrappers are the default, call-site churn is the exception.
- **Stay Radix until deliberately ported** (custom behavior = porting risk): `sheet.tsx` (`skipMountAnimation`, toast-aware `onInteractOutside`, size prop — the flicker-handoff pattern in project memory depends on it), `searchable-combobox.tsx`, `hover-card.tsx` (pending the step-4 port trial — stays only if the trial fails), `command.tsx` (cmdk, not Radix anyway), `form.tsx`, `sidebar.tsx` (fresh from 02 — don't churn it), `tabs.tsx`/`button.tsx`/`badge.tsx` (just touched in step 2; port opportunistically later).
- Radix + Base UI coexist; the unified `radix-ui` package stays until the last Radix consumer ports (future scope).

### 4. Opportunistic ports to shadcn primitives (D16)

- **`confirm-dialog.tsx`** → internals rebased from `Dialog` onto the already-installed `alert-dialog` primitives. The wrapper API (`confirmVariant`, labels, open/onConfirm contract) is unchanged — its **31 importers are untouched**. Deliberate behavior change riding along: AlertDialog does not dismiss on outside-click (correct semantics for destructive confirms); Esc still cancels. Moves to `@pts/ui/confirm-dialog`.
- **`hover-card.tsx`** → timeboxed trial (≤ half a day) porting to the official hover-card primitive: the custom open/close timers (50ms/200ms) map to `openDelay`/`closeDelay`, the controlled mode (PRD 003 D9/W8, used by the clients total-projects hover) maps to `open`/`onOpenChange`. **Acceptance gate: touch behavior** — the custom popover-based build opens on tap; real hover-card primitives are hover/focus-only. If tap-to-open parity can't be met on the clients table hovers, keep the custom component (it stays in `components/ui/`, noted in future scope) and abandon the port without ceremony.
- **Explicitly not ported** (assessed, rejected for now): `pagination-controls` (shadcn's pagination is presentational markup; ours is the windowing/cursor logic — nothing to align to), `searchable-combobox` (no shadcn Radix analogue; Base UI Combobox is the future target — [06-future-scope.md](06-future-scope.md)), toast→sonner (46 importers + the `data-toast` sheet-dismiss coupling; future scope), `disabled-field-tooltip`/`phone-input` (compositions, no analogue).

### 5. Dead-code + bug sweep

- Delete `scroll-area.tsx`, `alert.tsx` (zero importers re-verified at audit time — I2; re-verify at time of change).
- Delete `use-board-assigned-filter.ts` + its plumbing through `use-projects-board-core-state.ts` (~L30, L67) and `filterTasksByAssignee` call in `use-projects-board-derived-state.ts` (~L36) — superseded by 03's real filter system; **if** an "assigned to me" board filter is still wanted, it becomes a visible control instead (note in [06-future-scope.md](06-future-scope.md)).
- `command.tsx` a11y fix already landed in 01 — verify, don't re-do.

## Architecture notes

- Public component APIs are preserved by default — additive props (`density`) aside, feature-component call sites change only where table chrome standardizes or an import flips to `@pts/ui/*`. The exception is a Base UI migration where API preservation proves impractical: then the call-site changes ship in that component's own commit per the R6 contract (never spread across commits).
- The `dark:` classes and theming are untouched — Base UI components consume the same CSS variables, and the package is theme-agnostic (tokens live in each app's globals).
- `apps/client/`'s five copied components are **not** touched and it does not import `@pts/ui` yet (D12/D15); adoption is future scope.
- Two import roots coexist during this section by design (`@/components/ui/*` pending, `@pts/ui/*` done); PROGRESS.md tracks the set, and the section ends with `components/ui/` holding only the deliberately-unmoved set (the stay-Radix components and any bespoke holdouts).

## Acceptance criteria

- [ ] One `radix-ui` dependency; no `@radix-ui/react-*` entries remain; app builds and behaves identically
- [ ] Tabs render at `h-9` everywhere; buttons at exact `h-9/h-8/h-7`; no layout breakage on the style guide or key views
- [ ] Management tables render `density='compact'`; one header treatment + one container radius across all tables; invoice-settings tables gain the header fill
- [ ] The 14 migrated components are Base UI (verify imports); sheet/combobox/form/sidebar still Radix (hover-card per its trial outcome); zero visual regressions on `/design` side-by-sides
- [ ] Every Base UI migration commit carries its consumer inventory; `asChild` trigger call sites (Popover/DropdownMenu/Tooltip/AlertDialog) compose and focus correctly post-migration (R6)
- [ ] Sheet `skipMountAnimation` handoff (create→edit) and toast-click dismissal still work
- [ ] `scroll-area.tsx`, `alert.tsx`, `use-board-assigned-filter.ts` deleted; board unaffected
- [ ] `@pts/ui` exists with per-component exports; every refreshed/migrated component lives there with internal imports flipped; `turbo` builds/type-checks the package; client portal has no `@pts/ui` dependency
- [ ] `confirm-dialog` runs on alert-dialog internals — all 31 call sites work unchanged; outside-click no longer dismisses; Esc cancels
- [ ] `hover-card` port trial resolved either way: official primitive with tap-to-open parity on the clients table hovers, or documented keep-custom outcome
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root

## Files

**New:** `packages/ui/` (`package.json`, `tsconfig.json`, `components.json`, `src/*` receiving components incrementally, `src/cn.ts`, `src/hooks/use-mobile.ts`)
**Modified:** root `package.json`/workspace config · `apps/internal/package.json` (`@pts/ui` dep; radix consolidation; `@base-ui-components/react`) · `apps/internal/next.config.ts` (`transpilePackages`) · `apps/internal/app/globals.css` (`@source` for the package) · `apps/internal/lib/utils.ts` (`cn` re-export shim) · `apps/internal/components.json` · `apps/internal/components/ui/{tabs,button,skeleton,table,confirm-dialog,hover-card}.tsx` (refreshed → moved to `@pts/ui`) · the 14 migrated components (→ `@pts/ui`) · table-consuming sections (chrome standardization) · `apps/internal/components/tiptap-ui-primitive/{dropdown-menu,popover}` (import rewrite)
**Deleted:** `apps/internal/components/ui/scroll-area.tsx` · `apps/internal/components/ui/alert.tsx` · `apps/internal/lib/projects/board/state/use-board-assigned-filter.ts` (+ plumbing)
