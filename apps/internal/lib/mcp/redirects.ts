import 'server-only'

/**
 * Where an authorization code may be sent (PRD 009 Q3: hard allow-list).
 *
 * An MCP access token is a full Supabase session for the admin who approved
 * it — it can change their password, not just call MCP tools. Dynamic client
 * registration lets anyone register a client with any redirect URI, so
 * without this list a phished admin could hand an attacker's server a token
 * by clicking Connect. Codes only ever go to Claude or the admin's own
 * machine.
 *
 * Admitting another MCP client means adding its OAuth callback host here;
 * until then its users see "App not allowed" at consent.
 */
const HTTPS_HOSTS = new Set(['claude.ai', 'claude.com'])

/** Claude Code and MCP Inspector listen on a loopback port. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isAllowedRedirect(uri: string): boolean {
  let url: URL

  try {
    url = new URL(uri)
  } catch {
    return false
  }

  if (url.protocol === 'https:' && HTTPS_HOSTS.has(url.hostname)) {
    return true
  }

  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    LOOPBACK_HOSTS.has(url.hostname)
  )
}
