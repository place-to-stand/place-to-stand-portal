# 06 — Future Scope

Deliberately excluded from PRD 004; captured so decisions aren't re-litigated.

## Client-portal adoption of `@pts/ui`

The package is created in 004 (D15) with internal as sole consumer. `apps/client/` still carries five drifted copies (`button`, `badge`, `dropdown-menu`, `avatar`, `skeleton`) with `dark:` classes stripped, because its theming is structurally different (media-query dark mode vs `.dark` class, flat `@theme` block, hand-tuned radius ladder, no `components.json`). Adoption = decide one dark-mode mechanism + radius scale for the client app (note: Tailwind v4's `dark:` *defaults* to media-query, so the gap may be smaller than it looks), add the `@source`/`transpilePackages` wiring, flip its imports, delete the five copies. Until then, the guardrail from 04 (PI3) holds: no new component copies into `apps/client/components/ui/`. (D12/D15)

## Base UI: the stock-component migration (deferred from 04)

The 14-component Base UI migration was deferred at implementation time: R6's acceptance gate (per-component keyboard/focus verification on `/design`) requires an authenticated browser session the implementation environment didn't have. All prep landed — Radix consolidated to the unified package, density refreshed, `/design` ready as the acceptance surface — so the migration is now purely mechanical *with a browser*: flip `components.json` to base, regenerate per component (consumer inventory + `asChild` contract per R6), verify each on `/design`. The `hover-card` port trial resolved fail-safe the same way (kept custom pending tap-parity verification).

## Base UI: the custom components

Section 04 leaves `sheet.tsx`, `searchable-combobox.tsx`, `form.tsx`, `command.tsx`, `tabs.tsx`, `button.tsx`, `badge.tsx`, and `sidebar.tsx` on Radix (`hover-card.tsx` ports in 04 if the touch-parity trial succeeds, D16). Each is a deliberate, individually-tested port later — `sheet.tsx` first candidate once Base UI's dialog animation lifecycle is proven against the `skipMountAnimation` create→edit handoff (see project memory: route-param remount flicker). `searchable-combobox.tsx`'s target is **Base UI's real Combobox component** (no Radix analogue exists — the current popover+cmdk composite is the pattern shadcn recommends *because* Radix lacks one). The unified `radix-ui` package is removed when the last of these ports.

## ⌘K palette: beyond navigation

- **Actions**: "Add task", "Log time", "Add lead" as palette commands.
- **More record types**: tasks, invoices (by number), leads, submissions — each needs a search predicate + a sensible destination.
- **Recents/frecency**: persist recently visited records for zero-query suggestions.

## Board "assigned to me" filter

`use-board-assigned-filter.ts` (sessionStorage-persisted, fully plumbed, never rendered) is deleted in 04. If the feature is wanted, rebuild it as a visible `FilterSelect` on the project board using the 03 system — assignee multi-select, URL-persisted, consistent with every other view.

## Other

- **Toast system → sonner**: homegrown pub/sub toasts work; swap only if the `data-toast`/sheet interaction ever bites.
- **Saved views / filter chips / column visibility**: next tier of table UX once 03 usage patterns emerge.
- **TanStack Table**: only if the hand-rolled tables + `SortableTableHead` prove insufficient (e.g. column visibility/resizing demand a real column model). Widening a view's sort allowlist is not future scope — it's adding a cursor variant + swapping a `TableHead`.
- **`/settings` sub-shell**: settings pages share no local nav; a settings layout with its own section nav if settings grows.
- **Client-portal density pass**: apply 004's outcomes to `apps/client/` after (or with) the `packages/ui` extraction.
- **Group landing pages**: breadcrumb group segments (`Work`, `Sales`) are non-links today; add landing/overview pages if wanted.
