/**
 * Every keyboard shortcut in the internal portal, in one place.
 *
 * The keyboard shortcuts dialog (`?`) lists this registry, and the handlers
 * match against it with `matchesShortcut` (`./match.ts`), so a shortcut's keys
 * live only here: change them here and the handler, the tooltips and the list
 * all follow. Adding a shortcut means adding an entry here first; eslint
 * (`pts/shortcut-registry`) rejects a handler that reads `metaKey`/`ctrlKey`
 * by hand.
 *
 * Keys are written `mod+shift+z`: `mod` is ⌘ on a Mac and Ctrl elsewhere (both
 * are accepted on every platform), `ctrl` means the Control key itself, and the
 * last part is the key (`event.key`, lower case, or `escape`, `enter`).
 */

export type ShortcutGroup =
  'Anywhere' | 'Sheets' | 'Project board' | 'Planning chat' | 'Text editor'

export type Shortcut = {
  /** Primary combination, e.g. `mod+s`. */
  keys: string
  /** Other combinations that do the same thing (shown after "or"). */
  alternatives?: readonly string[]
  /** What it does, in the list. Sentence case, no full stop. */
  label: string
  group: ShortcutGroup
}

/** The order groups appear in the shortcuts dialog. */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  'Anywhere',
  'Sheets',
  'Project board',
  'Planning chat',
  'Text editor',
]

export const SHORTCUTS = {
  // Anywhere
  commandPalette: {
    keys: 'mod+k',
    label: 'Search and go to a page',
    group: 'Anywhere',
  },
  toggleSidebar: {
    keys: 'mod+b',
    label: 'Show or hide the sidebar',
    group: 'Anywhere',
  },
  showShortcuts: {
    keys: '?',
    label: 'Show keyboard shortcuts',
    group: 'Anywhere',
  },

  // Sheets (use-sheet-form-controls)
  save: { keys: 'mod+s', label: 'Save', group: 'Sheets' },
  undo: { keys: 'mod+z', label: 'Undo', group: 'Sheets' },
  redo: {
    keys: 'mod+shift+z',
    alternatives: ['ctrl+y'],
    label: 'Redo',
    group: 'Sheets',
  },
  // Handled by the Sheet primitive (Base UI dialog), listed for completeness.
  closeSheet: { keys: 'escape', label: 'Close', group: 'Sheets' },

  // Project board (use-record-cycle)
  previousProject: {
    keys: 'mod+[',
    label: 'Previous project',
    group: 'Project board',
  },
  nextProject: { keys: 'mod+]', label: 'Next project', group: 'Project board' },

  // Planning chat (task sheet → Plan)
  sendPlanningMessage: {
    keys: 'enter',
    label: 'Send message',
    group: 'Planning chat',
  },
  planningNewLine: {
    keys: 'shift+enter',
    label: 'New line',
    group: 'Planning chat',
  },

  // Text editor. Tiptap's extensions bind these; the toolbar tooltips read
  // them from here (components/tiptap-ui/*), so the two can't drift.
  bold: { keys: 'mod+b', label: 'Bold', group: 'Text editor' },
  italic: { keys: 'mod+i', label: 'Italic', group: 'Text editor' },
  underline: { keys: 'mod+u', label: 'Underline', group: 'Text editor' },
  strike: { keys: 'mod+shift+x', label: 'Strikethrough', group: 'Text editor' },
  code: { keys: 'mod+e', label: 'Inline code', group: 'Text editor' },
  highlight: { keys: 'mod+shift+h', label: 'Highlight', group: 'Text editor' },
  link: { keys: 'mod+k', label: 'Add or edit a link', group: 'Text editor' },
  superscript: { keys: 'mod+.', label: 'Superscript', group: 'Text editor' },
  subscript: { keys: 'mod+,', label: 'Subscript', group: 'Text editor' },
  heading1: { keys: 'mod+alt+1', label: 'Heading 1', group: 'Text editor' },
  heading2: { keys: 'mod+alt+2', label: 'Heading 2', group: 'Text editor' },
  heading3: { keys: 'mod+alt+3', label: 'Heading 3', group: 'Text editor' },
  heading4: { keys: 'mod+alt+4', label: 'Heading 4', group: 'Text editor' },
  bulletList: {
    keys: 'mod+shift+8',
    label: 'Bullet list',
    group: 'Text editor',
  },
  orderedList: {
    keys: 'mod+shift+7',
    label: 'Numbered list',
    group: 'Text editor',
  },
  taskList: { keys: 'mod+shift+9', label: 'Checklist', group: 'Text editor' },
  blockquote: { keys: 'mod+shift+b', label: 'Quote', group: 'Text editor' },
  codeBlock: { keys: 'mod+alt+c', label: 'Code block', group: 'Text editor' },
  alignLeft: { keys: 'mod+shift+l', label: 'Align left', group: 'Text editor' },
  alignCenter: {
    keys: 'mod+shift+e',
    label: 'Align center',
    group: 'Text editor',
  },
  alignRight: {
    keys: 'mod+shift+r',
    label: 'Align right',
    group: 'Text editor',
  },
} as const satisfies Record<string, Shortcut>

export type ShortcutId = keyof typeof SHORTCUTS

/** The registry as groups, in dialog order, each in registry order. */
export function shortcutsByGroup(): Array<{
  group: ShortcutGroup
  shortcuts: Array<Shortcut & { id: ShortcutId }>
}> {
  const entries = Object.entries(SHORTCUTS) as Array<[ShortcutId, Shortcut]>
  return SHORTCUT_GROUPS.map(group => ({
    group,
    shortcuts: entries
      .filter(([, shortcut]) => shortcut.group === group)
      .map(([id, shortcut]) => ({ id, ...shortcut })),
  })).filter(section => section.shortcuts.length > 0)
}
