# Table

The data table: plain semantic markup with shadcn styling and two options, `density` and `layout`. From `@pts/ui/table`.

**Look:** `text-sm`, rows `border-b hover:bg-muted/50`, selected `bg-muted`. `TableHead` is `h-10 px-2 font-medium text-foreground`; `TableCell` is `p-2`. `density="compact"`: heads `h-8 text-xs`, cells `px-2 py-1.5`. `TableFooter` is `bg-muted/50 border-t font-medium`. Cells are `whitespace-nowrap`.

**Rules**
- Every sortable table sets `layout='fixed'`, gives each `TableHead` a width class, and puts `truncate` on long-text cells, so sorting and paging can't make columns jump. (Unwidthed columns split leftover space equally — set widths before switching.)
- Numbers (hours, money, counts) are right-aligned with `tabular-nums`.
- Dates render through `formatCalendarDate` ("Sep 23, 2026").
- Row actions are `icon-sm` ghost Buttons or a DropdownMenu; in-row toggles may apply instantly (unlike sheet controls).
- Page counts come from `PageShell` ("Showing 24 of 118 clients"); empty states are one sentence ("No matching tasks.").
