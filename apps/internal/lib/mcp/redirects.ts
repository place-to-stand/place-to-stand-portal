import 'server-only'

/**
 * Where an authorization code may be sent: a hard allow-list.
 *
 * An MCP access token is a full Supabase session for the person who approved
 * it — it can change their password, not just call MCP tools. Dynamic client
 * registration lets anyone register a client with any redirect URI, so
 * without this list a phished user could hand an attacker's server a token
 * by clicking Connect. Codes only ever go to Claude, ChatGPT or the user's
 * own machine.
 *
 * Admitting another MCP client means adding its OAuth callback host here;
 * until then its users see "App not allowed" at consent.
 */
const HTTPS_HOSTS = new Set(['claude.ai', 'claude.com'])

/**
 * ChatGPT's MCP connectors, by exact callback path rather than whole host:
 * chatgpt.com also serves custom-GPT OAuth callbacks (`/aip/<gpt>/oauth/...`)
 * that any GPT author controls, so only the connector platform's own paths
 * may receive a code. ChatGPT uses `/connector/oauth/<callback id>`, or the
 * fixed `/connector_platform_oauth_redirect` for servers that send `iss`.
 * Neither carries a query, fragment or userinfo, so those are refused too.
 */
const CHATGPT_HOST = 'chatgpt.com'
const CHATGPT_CALLBACK_PATHS = [
  /^\/connector_platform_oauth_redirect$/,
  /^\/connector\/oauth\/[A-Za-z0-9_-]+$/,
]

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

  if (
    url.protocol === 'https:' &&
    url.hostname === CHATGPT_HOST &&
    !url.port &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    CHATGPT_CALLBACK_PATHS.some(path => path.test(url.pathname))
  ) {
    return true
  }

  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    LOOPBACK_HOSTS.has(url.hostname)
  )
}
