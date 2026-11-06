export type GmailThreadSummary = {
  id: string
  /** The viewer's Google account the thread lives in. */
  accountEmail: string | null
  subject: string
  snippet: string
  /** Who sent the newest message: their name, else their address. */
  lastFrom: string | null
  /** When the newest message arrived (ISO). */
  lastAt: string | null
  messageCount: number
  /** Opens the thread in Gmail, in the right account. */
  url: string
}

const ADDRESS_PATTERN = /^[^\s@"(){}<>]+@[^\s@"(){}<>]+\.[^\s@"(){}<>]+$/

/**
 * A Gmail search for threads any of `addresses` sent, received or was
 * copied on. Addresses that don't look like one are dropped, so nothing
 * typed into a contact can widen the search.
 */
export function buildAddressQuery(addresses: string[]): string | null {
  const clean = [
    ...new Set(
      addresses
        .map(address => address.trim().toLowerCase())
        .filter(address => ADDRESS_PATTERN.test(address))
    ),
  ]
  if (clean.length === 0) return null
  const terms = clean.flatMap(address => [
    `from:${address}`,
    `to:${address}`,
    `cc:${address}`,
  ])
  return `{${terms.join(' ')}}`
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** Gmail's snippets come HTML-escaped (`&#39;`); show them as text. */
export function decodeGmailSnippet(snippet: string): string {
  return snippet.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#')) {
      const hex = code[1]?.toLowerCase() === 'x'
      const value = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : match
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}

/** `"Ada Lovelace" <ada@example.com>` → `Ada Lovelace`; a bare address stays. */
export function parseFromName(from: string | null): string | null {
  if (!from) return null
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (!match) return from.trim() || null
  return match[1]?.trim() || match[2]?.trim() || null
}

/** Opens a thread in Gmail, signed in as the account it belongs to. */
export function gmailThreadUrl(
  threadId: string,
  accountEmail: string | null
): string {
  const account = accountEmail
    ? `?authuser=${encodeURIComponent(accountEmail)}`
    : ''
  return `https://mail.google.com/mail/${account}#all/${encodeURIComponent(threadId)}`
}
