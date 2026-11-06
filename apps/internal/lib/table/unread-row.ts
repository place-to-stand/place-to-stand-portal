/**
 * An unread row (a submission nobody has acknowledged): a heavier weight on
 * a faint tint. The tint stays while the unread dot gives way to the select
 * box on hover, so the row still reads as unread. Hovered it deepens a step,
 * and ticked it takes the full selected tint (`muted`).
 */
export const UNREAD_ROW_CLASS = 'font-medium bg-muted/50 hover:bg-muted/75'
