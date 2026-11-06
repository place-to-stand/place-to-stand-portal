import type { Shortcut } from './shortcuts'

type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'
>

type ParsedKeys = {
  key: string
  mod: boolean
  ctrl: boolean
  shift: boolean
  alt: boolean
}

function parseKeys(keys: string): ParsedKeys {
  // Split on `+` but keep a literal `+` key (`mod++`).
  const parts = keys.toLowerCase().split(/\+(?!$)/)
  const key = parts.pop() ?? ''
  return {
    key,
    mod: parts.includes('mod'),
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  }
}

/** A single letter or digit, where Shift is a separate choice. */
const SHIFT_IS_SEPARATE = /^[a-z0-9]$|^(enter|escape|tab|backspace)$/

function matchesKeys(event: KeyEventLike, keys: string): boolean {
  if (!event.key) return false
  const want = parseKeys(keys)
  if (event.key.toLowerCase() !== want.key) return false

  if (want.ctrl) {
    // `ctrl+y`: the Control key itself, without ⌘.
    if (!event.ctrlKey || event.metaKey) return false
  } else if (want.mod) {
    // ⌘ or Ctrl on every platform, the convention the portal has always used.
    if (!event.metaKey && !event.ctrlKey) return false
  } else if (event.metaKey || event.ctrlKey) {
    return false
  }

  // Shift and Alt (AltGr) are how many layouts type a symbol like `?` or `[`
  // (German: AltGr+8), so only letters, digits and named keys check them
  // (`mod+z` must not fire on ⇧⌘Z).
  if (SHIFT_IS_SEPARATE.test(want.key)) {
    if (want.shift !== event.shiftKey || want.alt !== event.altKey) return false
  }
  return true
}

/** Whether a keydown event is this shortcut (or one of its alternatives). */
export function matchesShortcut(
  event: KeyEventLike,
  shortcut: Shortcut
): boolean {
  return [shortcut.keys, ...(shortcut.alternatives ?? [])].some(keys =>
    matchesKeys(event, keys)
  )
}

/**
 * Whether the event comes from somewhere you type: a field, a text area or the
 * rich text editor. App-wide shortcuts yield there, because the same keys mean
 * something to the text (⌘B is bold, `?` is a question mark).
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  // A node inside the editor (a link, a task-list checkbox) rather than the
  // editable host itself.
  return target.closest('[contenteditable="true"]') !== null
}
