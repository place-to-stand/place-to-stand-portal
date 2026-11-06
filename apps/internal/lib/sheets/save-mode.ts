/**
 * What a sheet does after a successful save.
 *
 * - `close`: Save and close, the default (the primary button, Enter in a
 *   field, ⌘S / Ctrl+S).
 * - `stay`: Save and keep the sheet open on the saved record (the second
 *   button, ⇧⌘S / Ctrl+Shift+S). An edit sheet re-baselines to what it saved;
 *   a create sheet becomes the new record's edit sheet.
 *
 * The keys live in the shortcut registry (`SHORTCUTS.save`,
 * `SHORTCUTS.saveAndStay`). Both go through the sheet's one submit function, so anything that guards a
 * save (validation, the stale-save check) covers both.
 */
export type SheetSaveMode = 'close' | 'stay'

const SAVE_MODE_EVENT = 'pts:sheet-save-mode'
let lastAnnounced = { mode: 'close' as SheetSaveMode, at: 0 }

/**
 * Says which save is starting, so the footer shows "Saving..." on the button
 * that matches it. The footer's own buttons and the ⌘S / ⇧⌘S handler call
 * this; a native form submit (Enter, the primary button) counts as `close`.
 */
export function announceSaveMode(mode: SheetSaveMode) {
  lastAnnounced = { mode, at: Date.now() }
  window.dispatchEvent(
    new CustomEvent<SheetSaveMode>(SAVE_MODE_EVENT, { detail: mode })
  )
}

/**
 * The mode of a native form submit: the one just announced (some sheets save
 * by submitting their form, for both modes), else `close` (Enter in a field).
 */
export function modeOfFormSubmit(): SheetSaveMode {
  return Date.now() - lastAnnounced.at < 250 ? lastAnnounced.mode : 'close'
}

/**
 * The save in flight when a footer mounts mid-save (some sheets remount it
 * while they reload): the last announced one, if recent.
 */
export function modeInFlight(): SheetSaveMode {
  return Date.now() - lastAnnounced.at < 10_000 ? lastAnnounced.mode : 'close'
}

export function onSaveModeAnnounced(listener: (mode: SheetSaveMode) => void) {
  const handle = (event: Event) =>
    listener((event as CustomEvent<SheetSaveMode>).detail)
  window.addEventListener(SAVE_MODE_EVENT, handle)
  return () => window.removeEventListener(SAVE_MODE_EVENT, handle)
}

const SAVED_EVENT = 'pts:sheet-saved'
let lastKeptOpenSaveAt = 0

/**
 * A keep-open save succeeded. The sheet stays on screen, so instead of a
 * toast its Save button reads "Saved" for a moment. Failures and warnings
 * still toast.
 */
export function announceKeptOpenSave() {
  lastKeptOpenSaveAt = Date.now()
  window.dispatchEvent(new Event(SAVED_EVENT))
}

export function onKeptOpenSave(listener: () => void) {
  window.addEventListener(SAVED_EVENT, listener)
  return () => window.removeEventListener(SAVED_EVENT, listener)
}

/**
 * How long ago the last keep-open save landed, in ms. A sheet that remounts
 * its footer while reloading (a create becoming its record's sheet) reads
 * this so "Saved" still shows.
 */
export function msSinceKeptOpenSave() {
  return Date.now() - lastKeptOpenSaveAt
}
