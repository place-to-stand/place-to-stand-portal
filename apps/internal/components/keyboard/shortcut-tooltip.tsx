import { ariaKeyShortcuts } from '@/lib/keyboard/format'
import type { Shortcut } from '@/lib/keyboard/shortcuts'

import { ShortcutKeys } from './shortcut-keys'

/**
 * Props that put a shortcut on a RowActionButton: the keys after the label in
 * its tooltip ("Undo ⌘Z") and `aria-keyshortcuts` for screen readers.
 * `<RowActionButton label='Undo' {...rowActionShortcut(SHORTCUTS.undo)} />`
 *
 * Labelled buttons ("Save") get no tooltip just to show keys; they set
 * `aria-keyshortcuts` and leave the keys to the shortcuts list (`?`).
 */
export function rowActionShortcut(shortcut: Shortcut) {
  return {
    shortcut: <ShortcutKeys shortcut={shortcut} />,
    'aria-keyshortcuts': ariaKeyShortcuts(shortcut),
  }
}
