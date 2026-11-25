/**
 * Which websites may send feedback for a project. A browser always sends an
 * `Origin` header with a cross-site POST, and a page's script can't change
 * it, so checking it keeps reports to the project's own sites. (A script run
 * outside a browser can fake it: the rate limits and the triage list are what
 * stop that.)
 */

/**
 * `shop.example.com`, `https://shop.example.com/` and
 * `https://Shop.Example.com/any/path` all become `https://shop.example.com`.
 * A bare host is taken as https (http for localhost). Anything that isn't an http(s) address
 * with a real host name (one with a dot, `localhost` or an IP address) is
 * null, so a stray word like `staging` is refused, not saved as a site.
 */
export function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  // A bare host is https, except a local one, which dev servers serve on http.
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(trimmed)
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${local ? 'http' : 'https'}://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!url.hostname || url.username || url.password) return null
  const host = url.hostname
  const realHost =
    host === 'localhost' || host.startsWith('[') || /\.[a-z0-9-]+$/i.test(host)
  if (!realHost || host.endsWith('.')) return null
  return url.origin
}

/** The project's own list plus its linked Vercel production domains. */
export function allowedFeedbackOrigins({
  origins,
  productionDomains,
}: {
  origins: readonly string[]
  productionDomains: readonly (string | null | undefined)[]
}): Set<string> {
  const allowed = new Set<string>()
  for (const value of [...origins, ...productionDomains]) {
    if (!value) continue
    const origin = normalizeOrigin(value)
    if (origin) allowed.add(origin)
  }
  return allowed
}

/** True when the request's Origin header is one of the allowed websites. */
export function isFeedbackOriginAllowed(
  origin: string | null,
  allowed: ReadonlySet<string>
): boolean {
  // "null" is what a sandboxed frame or a file:// page sends.
  if (!origin || origin === 'null') return false
  const normalized = normalizeOrigin(origin)
  return normalized !== null && allowed.has(normalized)
}

/**
 * Parses the websites an admin typed (one per line, or separated by commas)
 * into a clean list, or the entries that aren't websites.
 */
export function parseFeedbackOriginsInput(
  input: string
): { ok: true; origins: string[] } | { ok: false; invalid: string[] } {
  const entries = input
    .split(/[\n,]+/)
    .map(entry => entry.trim())
    .filter(Boolean)
  const origins: string[] = []
  const invalid: string[] = []
  for (const entry of entries) {
    const origin = normalizeOrigin(entry)
    if (origin) {
      if (!origins.includes(origin)) origins.push(origin)
    } else {
      invalid.push(entry)
    }
  }
  return invalid.length > 0 ? { ok: false, invalid } : { ok: true, origins }
}
