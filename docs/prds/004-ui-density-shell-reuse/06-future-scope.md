# 06 — Future Scope

Deliberately excluded from PRD 004; captured so decisions aren't re-litigated.

## Client-portal adoption of `@pts/ui`

The package is created in 004 (D15) with internal as sole consumer. `apps/client/` still carries five drifted copies (`button`, `badge`, `dropdown-menu`, `avatar`, `skeleton`) with `dark:` classes stripped, because its theming is structurally different (media-query dark mode vs `.dark` class, flat `@theme` block, hand-tuned radius ladder, no `components.json`). Adoption = decide one dark-mode mechanism + radius scale for the client app (note: Tailwind v4's `dark:` *defaults* to media-query, so the gap may be smaller than it looks), add the `@source`/`transpilePackages` wiring, flip its imports, delete the five copies. Until then, the guardrail from 04 (PI3) holds: no new component copies into `apps/client/components/ui/`. (D12/D15)

## Base UI: the custom components

The 14 stock components are migrated (Base UI primitives under the original New York classes — see PROGRESS). `sheet.tsx` has since been ported too (Aug 2026, sheet-consolidation effort): `@base-ui/react/dialog` with the `size`/`skipMountAnimation` API preserved (`data-open:animate-none` replaces the Radix `data-[state=open]` variant) and the outside-press allowlist moved from `Content.onInteractOutside` to a `Root.onOpenChange` guard that calls `eventDetails.cancel()` on `outside-press` inside whitelisted portals; smoke harness covers open/closed sheet compositions. Still on Radix, each a deliberate individually-tested port later: `form.tsx`, `sidebar.tsx`, `hover-card.tsx` (kept custom — tap-parity trial unresolved), `tabs.tsx`, `button.tsx`, `badge.tsx` (Slot only), and `command.tsx` (cmdk, not Radix). `searchable-combobox.tsx` now rides the Base UI popover wrapper + cmdk; its real target remains **Base UI's Combobox component**. The unified `radix-ui` package is removed when the last of these ports. Note: `components.json` is now `base-nova`, so future `shadcn add`s arrive Base-styled and need a look-pass against the house New York styling.

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
