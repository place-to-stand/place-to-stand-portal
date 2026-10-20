# Table

The data table: plain semantic markup with shadcn styling and three options, `density`, `layout` and `stack`, plus a floor width set through `className`. From `@pts/ui/table`.

**Look:** `text-sm`, rows `border-b hover:bg-muted/50`, selected `bg-muted`. `TableHead` is `h-10 px-2 font-medium text-foreground`; `TableCell` is `p-2`. `density="compact"`: heads `h-8 text-xs`, cells `px-2 py-1.5`. `TableFooter` is `bg-muted/50 border-t font-medium`. Cells are `whitespace-nowrap`.

**Phones (`stack`):** below `md` a stacked table drops its header and turns each row into a compact card: the first cell is a full-width title line and the rest wrap beneath it. Pass `label` to a cell whose value needs a name once the header is gone ("Hours", "Last sign-in"); self-describing values (badges, icon + text) go without. Give the actions cell `max-md:ml-auto`, and drop an empty cell with `max-md:hidden` rather than showing a lone dash. A cell that should lead the card instead of the first one takes `max-md:order-first max-md:basis-full` (the first cell then needs `max-md:first:basis-auto`).

**Tablets and small laptops (floor width):** from `md` up a fixed-layout table keeps its columns, and with the sidebar open the content area is only about 30rem wide at 768px and 47rem at 1024px. Percentage widths shrink with it while cells stay `whitespace-nowrap`, so columns overprint. A table that doesn't fit gives itself a floor with `md:min-w-[…]` on `Table`, the narrowest width at which its columns hold their content (with headroom: real phone numbers, totals and names run longer than the fixtures), and below that it scrolls sideways inside its card. The floor never applies to a stacked phone layout, and it must stay at or under the table's width at 1440px with the sidebar open (72.75rem), so wide screens don't change. Current floors: clients 62.5rem; projects, invoices, users, contacts and submissions 50rem; submissions archive 60rem (its Archived column takes the room Company would need, so the archive keeps Company and the source detail hidden until `2xl` and gives its Outcome and Source columns smaller shares); projects archive 48rem; lead archive 46rem; hour blocks 42rem; product catalog and the unstacked clients archive 38rem (unprefixed, so it also scrolls on a phone). Tax rates fits without one.

**Rules**
- Every list table sets `stack`. A grid read across its columns (the monthly close payouts) keeps its columns instead and scrolls inside its card from a floor width.
- Every `layout='fixed'` table whose columns overprint at 768px with the sidebar open sets an `md:min-w-[…]` floor (see above). Measure it rather than guess: widen the table in devtools until no cell's content spills, then round up. Card stacking stays below `md`; extending it to `lg` wouldn't help, since `lg` starts at 1024px, where the clients table already overprints.
- Every sortable table sets `layout='fixed'`, gives each `TableHead` a width class, and puts `truncate` on long-text cells, so sorting and paging can't make columns jump. (Unwidthed columns split leftover space equally — set widths before switching.)
- Numbers (hours, money, counts) are right-aligned with `tabular-nums`.
- Dates render through `formatCalendarDate` ("Sep 23, 2026").
- Row actions are `RowActionButton`s (every icon-only one, so each has a hover tooltip) or a DropdownMenu; in-row toggles may apply instantly (unlike sheet controls).
- Page counts come from `PageShell` ("Showing 24 of 118 clients"); empty states are one sentence ("No matching tasks.").
