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
