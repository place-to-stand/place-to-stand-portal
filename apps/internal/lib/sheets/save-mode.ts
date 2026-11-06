/**
 * What a sheet does after a successful save.
 *
 * - `close`: Save and close, the default (the primary button, Enter in a
 *   field, ⌘S / Ctrl+S).
 * - `stay`: Save and keep the sheet open on the saved record (the second
 *   button, ⇧⌘S / Ctrl+Shift+S). An edit sheet re-baselines to what it saved;
 *   a create sheet becomes the new record's edit sheet.
 *
 * Both go through the sheet's one submit function, so anything that guards a
 * save (validation, the stale-save check) covers both.
 */
export type SheetSaveMode = 'close' | 'stay'

export const SAVE_AND_CLOSE_SHORTCUT = '⌘S / Ctrl+S'
export const SAVE_AND_STAY_SHORTCUT = '⇧⌘S / Ctrl+Shift+S'
