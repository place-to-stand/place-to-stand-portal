/**
 * Dimming for archived table rows. The fade is applied per-cell rather than
 * to the row so the trailing Actions cell can opt back out — restore/delete
 * controls are the whole point of an archive view and must stay legible.
 *
 * The leading select box stays sharp too, for bulk restore.
 *
 * Every archive table renders Actions as its last column; the empty-state
 * row never carries this class, so `td:last-child` is unambiguous.
 */
export const ARCHIVED_ROW_CLASS =
  '[&>td]:opacity-60 [&>td:last-child]:opacity-100 [&>td[data-slot=table-select-cell]]:opacity-100'
