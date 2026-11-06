# Bulk select

Tick rows in a list, then act on them together. From `components/table/bulk-select`: `useRowSelection`, `RowSelectionProvider`, `SelectAllHead`, `SelectRowCell`, `BulkActionBar`. Shown on `/design#bulk-select`.

**Look:** a 36px leading column (`w-9`) on every list with an Archive row action. Each row's 16px `Checkbox` stays hidden until the row is hovered or focused; the header box shows while the table is hovered. Once one row is ticked every box shows, ticked rows take the shared selected tint (`data-selected`, `bg-muted`), and the bulk bar rises at the bottom centre: "3 companies selected", then the list's own actions (outline, e.g. Submissions' Acknowledge), then Archive (destructive) on an active list or Restore (outline) on an Archive tab, then a clear ×. Phones have no hover and little room, so below `md` the column is hidden and an unread row keeps its tint.

**Unread rows** share the column: the dot sits where the box will be and gives way to it on hover. The row carries `UNREAD_ROW_CLASS` (`lib/table/unread-row.ts`: medium weight on a `bg-muted/50` tint that deepens to `muted/75` on hover; ticked, it takes the full selected `muted`), so it still reads as unread while the dot is hidden.

**Selecting:** a click anywhere in the cell ticks the row and never opens it; shift-click ticks a range. The header box ticks the page (or clears it when the page is all ticked). With the whole page ticked and more rows matching, the bar offers "Select all 118 people" (an outline button with a double check): every row matching the filters, on every page, offered only up to 500 rows (more asks you to narrow the filters). Unticking any row drops back to the page's ticks. Ticks clear when the page's rows change (paging, filtering, a refresh after the action). A list split into several tables (Projects) passes each table's ids to `SelectAllHead ids={…}`.

**Acting:** `bulkSetArchived` (`app/(dashboard)/_actions/bulk-archive.ts`) runs each row through the same archive or restore its row button uses (`BULK_ARCHIVE_REGISTRY`), up to 500 rows, so every rule, refusal and activity entry matches. The bar resolves "all matching" to ids first (`resolveBulkMatchingIds`), then sends them 25 at a time (`runInChunks`, `lib/bulk/run-in-chunks.ts`) so no call nears the function time limit; a call that fails stops the run with an "Unable to …" toast, refreshes the list to show what changed, and never replaces the page with the error screen. Archive confirms first with the shared `ArchiveConfirmDialog` (`many`); restore runs at once, like the row button. One toast reports the result: "12 companies archived", or "10 companies archived, 2 not" naming the refused rows and why. Closed-month notes follow as their own warning toast.

**List actions:** a list can add its own bulk actions through `BulkActionBar actions` (`BulkBarAction`: label, icon, the verb for the toasts, and a server action taking the selection). Each runs its row action per row with the shared `runBulk` and `resolveBulkIds` (`app/(dashboard)/_lib/`). Submissions has one: Acknowledge (`bulkAcknowledgeSubmissions`), which sends each ticked row's version as rendered, so a row that changed since is refused rather than acknowledged unseen.

**Rules**

- Every list with an Archive or Restore row action has the select column as its first column, through `SelectRowCell` and `SelectAllHead`; never a hand-rolled checkbox column. (guard: review)
- An unread marker lives in the select column (`SelectRowCell unread`), never in another cell, and its row carries `UNREAD_ROW_CLASS`. (guard: review)
- A bulk action reuses the single-row action for each row; it never writes the table itself. (guard: review)
- Adding a list: add its words to `BULK_ARCHIVE_ENTITIES`, its matching query and row action to `BULK_ARCHIVE_REGISTRY`, then the three components; add one to the empty-state `colSpan`. (guard: review)
