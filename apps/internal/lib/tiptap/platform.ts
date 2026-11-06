import { detectMac, formatKey } from '@/lib/keyboard/format'

export function cn(
  ...classes: Array<string | boolean | undefined | null>
): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Formats a shortcut key based on the platform (Mac or non-Mac)
 * @param key - The key to format (e.g., "ctrl", "alt", "shift")
 * @param isMacPlatform - Boolean indicating if the platform is Mac
 * @param capitalize - Whether to capitalize the key (default: true)
 * @returns Formatted shortcut key symbol
 */
const formatShortcutKey = (
  key: string,
  isMacPlatform: boolean,
  capitalize: boolean = true
) => {
  // Same labels as the keyboard shortcuts list (lib/keyboard/format.ts).
  const label = formatKey(key, isMacPlatform)
  if (label !== key && label !== key.toUpperCase()) return label
  return capitalize ? key.toUpperCase() : key
}

/**
 * Parses a shortcut key string into an array of formatted key symbols
 * @param shortcutKeys - The string of shortcut keys (e.g., "ctrl-alt-shift")
 * @param delimiter - The delimiter used to split the keys (default: "+")
 * @param capitalize - Whether to capitalize the keys (default: true)
 * @returns Array of formatted shortcut key symbols
 */
export const parseShortcutKeys = (props: {
  shortcutKeys: string | undefined
  delimiter?: string
  capitalize?: boolean
}) => {
  const { shortcutKeys, delimiter = '+', capitalize = true } = props

  if (!shortcutKeys) return []

  return shortcutKeys
    .split(delimiter)
    .map(key => key.trim())
    .map(key => formatShortcutKey(key, detectMac(), capitalize))
}
