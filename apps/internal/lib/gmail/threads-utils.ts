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

/** One of the viewer's connected Google accounts. */
export type GmailAccount = { id: string; email: string | null }

/** Where the next page starts: Gmail's page token per connected account. */
export type ThreadsCursor = Record<string, string>

/**
 * Reads a cursor sent back by the browser. Anything that isn't a small map
 * of short strings is ignored, and the server only ever looks up the
 * viewer's own account ids in it.
 */
export function parseThreadsCursor(value: string | null): ThreadsCursor | null {
  if (!value || value.length > 4000) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }
  const cursor: ThreadsCursor = {}
  for (const [key, token] of Object.entries(parsed)) {
    if (typeof token === 'string' && token.length > 0 && token.length < 1000) {
      cursor[key] = token
    }
  }
  return Object.keys(cursor).length > 0 ? cursor : null
}

const ADDRESS_PATTERN = /^[^\s@"(){}<>]+@[^\s@"(){}<>]+\.[^\s@"(){}<>]+$/

/**
 * A Gmail search for threads any of `addresses` sent, received or was
 * copied (or blind copied) on. Addresses that don't look like one are dropped, so nothing
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
    `bcc:${address}`,
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

/**
 * Opens a thread in Gmail, signed in as the account it belongs to. The API's
 * thread id is hex; Gmail's own links use it as a decimal `thread-f:` id
 * (checked against the links Gmail itself returns, Nov 2026).
 */
export function gmailThreadUrl(
  threadId: string,
  accountEmail: string | null
): string {
  const account = accountEmail
    ? `?authuser=${encodeURIComponent(accountEmail)}`
    : ''
  const anchor = /^[0-9a-f]{1,16}$/i.test(threadId)
    ? `thread-f:${BigInt(`0x${threadId}`).toString()}`
    : encodeURIComponent(threadId)
  return `https://mail.google.com/mail/${account}#all/${anchor}`
}

/**
 * Whether a failed Gmail response means the token itself is bad (reconnect),
 * as opposed to a rate limit or a missing thread. Gmail answers rate limits
 * with 403 too, so a 403 only counts when its reason isn't a limit.
 */
export function isGmailAuthFailure(status: number, body: string): boolean {
  if (status === 401) return true
  if (status !== 403) return false
  return !/rateLimitExceeded|userRateLimitExceeded|quotaExceeded|RATE_LIMIT/i.test(
    body
  )
}

/** Runs `fn` over `items`, at most `limit` at a time, keeping their order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index]) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )
  return results
}
