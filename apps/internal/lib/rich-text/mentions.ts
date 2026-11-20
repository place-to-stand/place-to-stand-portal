import { MENTION_TYPE } from './allowlist'

const TAG = /<span\b([^>]*)>/gi
const ATTRIBUTE = /([\w-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function attributesOf(source: string): Map<string, string> {
  const attributes = new Map<string, string>()
  for (const match of source.matchAll(ATTRIBUTE)) {
    attributes.set(
      match[1].toLowerCase(),
      match[3] ?? match[4] ?? match[5] ?? ''
    )
  }
  return attributes
}

/**
 * The people @mentioned in rich text, by user id, each once, in order.
 * Reads the editor's `<span data-type="mention" data-id="…">` markup.
 */
export function extractMentionIds(html: string | null | undefined): string[] {
  if (!html) return []
  const ids = new Set<string>()
  for (const match of html.matchAll(TAG)) {
    const attributes = attributesOf(match[1])
    const id = attributes.get('data-id') ?? ''
    if (attributes.get('data-type') === MENTION_TYPE && UUID.test(id)) {
      ids.add(id.toLowerCase())
    }
  }
  return [...ids]
}

/**
 * Who `html` mentions that `previousHtml` didn't: an edit tells only the
 * people it adds, never the ones already mentioned.
 */
export function addedMentionIds(
  html: string | null | undefined,
  previousHtml: string | null | undefined
): string[] {
  const before = new Set(extractMentionIds(previousHtml))
  return extractMentionIds(html).filter(id => !before.has(id))
}

/** The name a mention of `userId` shows (`data-label`), if `html` has one. */
export function mentionLabel(
  html: string | null | undefined,
  userId: string
): string | null {
  if (!html) return null
  for (const match of html.matchAll(TAG)) {
    const attributes = attributesOf(match[1])
    if (
      attributes.get('data-type') === MENTION_TYPE &&
      attributes.get('data-id')?.toLowerCase() === userId.toLowerCase()
    ) {
      return attributes.get('data-label') || null
    }
  }
  return null
}

/**
 * Up to `max` characters of `text`, cut on whole characters, around the
 * first `needle` (so a mention deep in long notes still shows), with … where
 * text was cut. From the start when the needle isn't there.
 */
export function excerptAround(text: string, needle: string | null, max = 140) {
  const flat = text.replace(/\s+/g, ' ').trim()
  const chars = Array.from(flat)
  if (chars.length <= max) return flat
  const at = needle ? flat.indexOf(needle) : -1
  // indexOf counts UTF-16 units; count whole characters instead.
  const position = at > 0 ? Array.from(flat.slice(0, at)).length : 0
  // Some words before the mention, for context.
  const start = Math.max(0, Math.min(position - 40, chars.length - max + 1))
  const lead = start > 0
  const end = start + max - 1 - (lead ? 1 : 0)
  const tail = end < chars.length
  return `${lead ? '…' : ''}${chars.slice(start, end).join('')}${tail ? '…' : ''}`
}
