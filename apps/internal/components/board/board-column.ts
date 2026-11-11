/**
 * A kanban column. Boards sit inside the page's `PagePanel`, below its
 * filter bar, like a list's table, so a column is a sunken well in that
 * panel (the table header's `muted/40`, the table's `rounded-lg` border),
 * not a second panel. Cards (`card` + border + shadow) sit on top of it.
 */
export const BOARD_COLUMN_CLASS = 'bg-muted/40 rounded-lg border'

/**
 * The board's `PagePanel`: filter bar on top, the board filling the rest of
 * the viewport (its columns scroll on their own).
 */
export const BOARD_PANEL_CLASS = 'flex min-h-0 flex-1 flex-col gap-4'
