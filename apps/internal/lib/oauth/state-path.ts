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
