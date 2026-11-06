import type { Shortcut } from './shortcuts'

const MAC_LABELS: Record<string, string> = {
  mod: '⌘',
  meta: '⌘',
  command: '⌘',
  ctrl: '⌃',
  control: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧',
  enter: '↩',
  escape: 'Esc',
  backspace: '⌫',
  delete: '⌦',
  capslock: '⇪',
}

const OTHER_LABELS: Record<string, string> = {
  mod: 'Ctrl',
  command: 'Ctrl',
  control: 'Ctrl',
  option: 'Alt',
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
  // `k` → `K`, `tab` → `Tab`
  return part.length === 1
    ? part.toUpperCase()
    : part.charAt(0).toUpperCase() + part.slice(1)
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

const ARIA_NAMES: Record<string, string> = {
  ctrl: 'Control',
  alt: 'Alt',
  shift: 'Shift',
  enter: 'Enter',
  escape: 'Escape',
}

/**
 * The `aria-keyshortcuts` value for a combination list, so screen readers
 * announce the shortcut: `mod+s` → `Meta+S Control+S`.
 */
export function ariaKeyShortcuts(
  shortcut: Pick<Shortcut, 'keys' | 'alternatives'>
): string {
  const combos = [shortcut.keys, ...(shortcut.alternatives ?? [])]
  return combos
    .flatMap(keys => {
      const parts = keys.split(/\+(?!$)/)
      const names = parts.map(part => {
        const lower = part.toLowerCase()
        return (
          ARIA_NAMES[lower] ?? (part.length === 1 ? part.toUpperCase() : part)
        )
      })
      if (!parts.some(part => part.toLowerCase() === 'mod')) {
        return [names.join('+')]
      }
      return ['Meta', 'Control'].map(mod =>
        names
          .map((name, i) => (parts[i].toLowerCase() === 'mod' ? mod : name))
          .join('+')
      )
    })
    .join(' ')
}
