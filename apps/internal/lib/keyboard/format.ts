const MAC_LABELS: Record<string, string> = {
  mod: '⌘',
  meta: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  enter: '↩',
  escape: 'Esc',
  backspace: '⌫',
}

const OTHER_LABELS: Record<string, string> = {
  mod: 'Ctrl',
  meta: 'Win',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  enter: 'Enter',
  escape: 'Esc',
  backspace: 'Backspace',
}

/** One part of a combination (`mod`, `shift`, `k`) as the keyboard shows it. */
export function formatKey(part: string, isMac: boolean): string {
  const lower = part.toLowerCase()
  const label = (isMac ? MAC_LABELS : OTHER_LABELS)[lower]
  if (label) return label
  return part.length === 1 ? part.toUpperCase() : part
}

/** `mod+shift+z` → `['⌘', '⇧', 'Z']` on a Mac, `['Ctrl', 'Shift', 'Z']` elsewhere. */
export function formatShortcutKeys(keys: string, isMac: boolean): string[] {
  return keys.split(/\+(?!$)/).map(part => formatKey(part, isMac))
}

/** `mod+shift+z` → `⌘⇧Z` on a Mac, `Ctrl+Shift+Z` elsewhere. */
export function formatShortcut(keys: string, isMac: boolean): string {
  return formatShortcutKeys(keys, isMac).join(isMac ? '' : '+')
}

export function detectMac(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /mac|iphone|ipad/i.test(navigator.platform)
  )
}
