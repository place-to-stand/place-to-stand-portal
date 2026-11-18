/**
 * Where to land after the provider sends the user back: a path inside the
 * portal (`/leads?lead=…`), never another site. Parsed the way the browser
 * will parse it, so tricks like `/\t/evil.com` can't leave the origin.
 */
export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/')) return null
  // Browsers drop tabs and newlines before parsing a URL.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null
  const base = 'https://portal.invalid'
  let parsed: URL
  try {
    parsed = new URL(value, base)
  } catch {
    return null
  }
  if (parsed.origin !== base) return null
  return `${parsed.pathname}${parsed.search}`
}

const ACCOUNT_INTEGRATIONS = '/my/home?account=integrations'

/**
 * Where an OAuth callback lands: the page the flow started from, else the
 * Account sheet. The result (`success=…` or `error=…`) rides along only when
 * the Account sheet is open there, since that is what reads it.
 */
export function oauthLandingPath(
  returnTo: string | null,
  result: { success: string } | { error: string }
) {
  const [key, value] = Object.entries(result)[0]
  const url = new URL(
    returnTo ?? ACCOUNT_INTEGRATIONS,
    'https://portal.invalid'
  )
  if (!url.searchParams.has('account')) return `${url.pathname}${url.search}`
  url.searchParams.delete('success')
  url.searchParams.delete('error')
  url.searchParams.set(key, value)
  return `${url.pathname}${url.search}`
}
