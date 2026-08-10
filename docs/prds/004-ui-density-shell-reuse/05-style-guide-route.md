# 05 — Hidden Style-Guide Route (`/design`)

**Depends on:** 01 (renders `PageShell`/`TabsNav`; built immediately after so 03/04 verify against it)
**App:** `apps/internal/`
**Decisions:** D9 (see [README.md](README.md))

## Problem

No Storybook, no showcase route, nothing renders the component library in one place. [docs/design-system.md](../../../apps/internal/docs/design-system.md) documents only the object-identity color system. Every density decision in 03/04 currently requires clicking through real pages to see.

## Fix

A static, admin-gated `/design` route group in `(dashboard)` — protected by the same `requireUser()` chain as everything else, simply **absent from `navigation-config.ts`** (reachable by URL and via a ⌘K nav entry, since the palette derives extra entries easily). No new dependencies, no interactivity beyond the components' own.

## Implementation

`app/(dashboard)/design/page.tsx` (under `apps/internal/`) + one `_components/` file per section (keep files under the 300-line guideline).

**Initial build (this section — everything that exists after 01):**

1. **Foundations** — color tokens (all `--*` theme vars as swatches, light/dark), radius scale, type scale, the object-identity entity colors from `design-system.md`.
2. **Primitives** — every `components/ui/*` component, all variants × sizes × states (default/hover/disabled/loading where applicable): buttons (incl. `xs`/`icon-sm`/`icon-lg`), badges, inputs/textarea/select/checkbox/switch (+`sm`)/label/form messages, tabs, tooltip, popover, dropdown, dialog/alert-dialog/confirm-dialog, sheet (all 5 sizes), avatar, skeleton, progress, separator, toast (trigger buttons), pagination-controls (both modes), searchable-combobox, phone-input, hover-card, disabled-field-tooltip, breadcrumb.
3. **Shell specimens** — `TabsNav`, breadcrumb variants (1/2/3 segments), the toolbar row with count + primary action, `PageShell` header itself (the page *is* rendered in it).

**Grows with later sections (the labs land as their subjects do — the page is the acceptance surface, not a blocker):**

4. **Toolbar lab** (added during 03) — the toolbar system with local-state (non-URL) wiring: `FilterBar` + single/multi `FilterSelect` + `SearchInput`.
5. **Table lab** (during 03/04) — `SortableTableHead` states (inactive/asc/desc, mixed with plain heads) from 03; then 04's standardized chrome: `density='default'` vs `'compact'` side by side, header treatment, empty + filtered-empty states, `PaginationControls` footer on sample data.
6. **Base UI side-by-sides** (during 04) — temporary Radix-vs-Base-UI blocks per component under migration; removed as each lands.

Sample data is inline constants — no queries, no server actions. Section nav via the page's own `TabsNav` or anchor links. As 04 moves components into `@pts/ui`, the page's imports flip with them (it's a consumer like any other).

## Acceptance criteria

- [ ] `/design` renders for admins; unauthenticated → sign-in; not present in the sidebar nav
- [ ] Every UI component (initially `components/ui/*`; `@pts/ui/*` as 04 progresses) appears with all variants/sizes; light + dark verified
- [ ] Foundations + primitives + shell specimens complete in the initial build
- [ ] Toolbar and table labs present by the end of 03/04 respectively, rendering both densities and all toolbar controls
- [ ] Page builds statically (no dynamic data), adds no new dependencies
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root

## Files

All paths under `apps/internal/`.

**New:** `app/(dashboard)/design/page.tsx` + `app/(dashboard)/design/_components/*` (one per section)
