# Filter

The controls in a list's `FilterBar` (and My tasks' and Leads' toolbar pickers). One trigger look, three kinds of popover.

**The trigger is `FieldTrigger`** (`apps/internal/components/ui/field-trigger.tsx`), the same field every picker uses: outline, `h-9`, `w-52` (`FILTER_TRIGGER_WIDTH`), the label, then the up-down chevron (`ChevronsUpDown` at 50%). Never a `ChevronDown`, never a hand-built button.

- **Label:** muted while the filter is at its default ("All clients", "This month"), `font-medium` once something is picked. Long labels truncate, with the full text as a tooltip.
- **Clear:** a `FieldClearButton` × sits inside the field, left of the chevron, whenever the filter is away from its default. It puts the filter back to the default (no "All" row needed). Reset in the bar clears every filter at once.
- **Badges:** when the list shows a filter's values as badges (statuses, the submission form, roles, the Client label), each option shows as that same `Badge`, in the popover and in the trigger once picked. Pass the list column's own tone mapping (`getProjectStatusToken`, `getLeadStatusToken`, `invoiceStatusTint`, `FORM_SUBMISSION_*_TOKENS`) as the option's `badgeClassName` (`''` is the plain outline badge), or a ready-made badge (`<ClientBadge />`) as `badge`. Never copy class strings. "All …" stays plain text.

**Single choice** is `FilterSelect` (`components/table-toolbar/filter-select.tsx`): the clearable `SearchableCombobox`, however short its list. "All …" is the placeholder; it opens on the picked option, typing narrows the list, and the picked option has a check on the **right** (no row reserves a left gutter for it).

**Multi choice** is `FilterSelect mode='multi'`: the same trigger (the first pick as it shows in the list, then "+N"), over a checkbox popover with Clear / Select all. `defaultValues` is the selection the list starts from (Projects: Onboarding + Active); the × shows away from it.

**Date range** is `DateRangePicker` (`components/ui/date-range-picker.tsx`) at the filter width: the same trigger naming the preset ("This month") or the dates, over presets beside a calendar. Pass `isDefault` and `onClear` so it reads muted at its default and clears back to it.

**Custom popovers keep the trigger.** My tasks' client scope is a `SearchableCombobox` with its "Show: Personal / Internal projects" toggles as a `listHeader` section at the top of the list. Any new filter with its own popover content renders `FieldTrigger` the same way.

**Rules**

- Filters sit in one row after the search from `md` up and wrap only when the row runs out; below `md` they move into the Filters sheet, where each stretches to the sheet's width.
- No labels above filters: the placeholder carries the meaning ("All statuses", "Everyone").
- Never a plain `Select` in a filter bar.
