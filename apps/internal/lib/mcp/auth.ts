import 'server-only'

import type { AuthInfo } from '@modelcontextprotocol/server'

import { INTERNAL_ROLES } from '@/lib/auth/roles'
import type { AppUser } from '@/lib/auth/session'
import { resolveUserFromToken, type BearerSurface } from '@/lib/cli/auth'
import { ForbiddenError, UnauthorizedError } from '@/lib/errors/http'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * Discovery document path for `/api/mcp`. RFC 9728 inserts the resource's
 * path after the well-known segment, so the advertised `resource` is the MCP
 * endpoint itself rather than the bare origin.
 */
export const MCP_RESOURCE_METADATA_PATH =
  '/.well-known/oauth-protected-resource/api/mcp'

const MCP_SURFACE: BearerSurface = {
  name: 'the MCP server',
  signInHint: 'Reconnect the app to sign in again.',
}

/** The OAuth client that made the call — the "via Claude" half of attribution. */
export type McpAgent = {
  clientId: string
  name: string
}

/** Who is acting on an MCP request: the human who connected, and the agent. */
export type McpPrincipal = {
  user: AppUser
  agent: McpAgent
}

type McpAuthExtra =
  | { principal: McpPrincipal; forbidden?: never }
  | { forbidden: string; principal?: never }

type AccessTokenClaims = {
  client_id?: string
  scope?: string
  exp?: number
}

/**
 * Read the payload of a JWT without verifying it. Only called after
 * `resolveUserFromToken` has validated the token with Supabase, so the claims
 * are trusted by then; on its own this proves nothing.
 */
function readClaims(token: string): AccessTokenClaims {
  const [, payload] = token.split('.')

  if (!payload) {
    return {}
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return {}
  }
}

/**
 * OAuth client names never change once registered, so a per-instance cache is
 * safe and saves an admin API round trip on every tool call.
 */
const agentNames = new Map<string, string>()

async function resolveAgentName(clientId: string): Promise<string> {
  const cached = agentNames.get(clientId)

  if (cached) {
    return cached
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.auth.admin.oauth.getClient(clientId)

  // Attribution should degrade, not fail the call: the human is still known.
  if (error || !data?.client_name) {
    return 'Unknown app'
  }

  agentNames.set(clientId, data.client_name)

  return data.client_name
}

/**
 * `verifyToken` for `withMcpAuth`. Returning `undefined` makes the wrapper
 * answer 401 with a challenge pointing at the discovery document, which is
 * what starts (or restarts) the client's OAuth flow.
 *
 * Only OAuth-issued tokens carry a `client_id`, so a CLI session token is
 * refused here even though it is a valid Supabase JWT — every MCP call must be
 * attributable to an agent.
 *
 * The MCP admits the internal portal's staff roles (ADMIN, SALES — PRD 009
 * D6, revised 2026-10-27); each tool then applies the same role rule the
 * portal does (`lib/mcp/tool.ts`). A valid token for anyone else (CLIENT) is
 * not an authentication failure; a 401 would just send the client round the
 * OAuth loop again. It is passed through as `forbidden` so the route can
 * answer 403.
 */
export async function verifyMcpToken(
  _request: Request,
  token?: string
): Promise<AuthInfo | undefined> {
  if (!token) {
    return undefined
  }

  const claims = readClaims(token)

  if (!claims.client_id) {
    return undefined
  }

  const base = {
    token,
    clientId: claims.client_id,
    scopes: claims.scope ? claims.scope.split(' ') : [],
    expiresAt: claims.exp,
  }

  try {
    const user = await resolveUserFromToken(
      token,
      MCP_SURFACE,
      INTERNAL_ROLES
    )
    const name = await resolveAgentName(claims.client_id)
    const extra: McpAuthExtra = {
      principal: { user, agent: { clientId: claims.client_id, name } },
    }

    return { ...base, extra }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return undefined
    }

    if (error instanceof ForbiddenError) {
      const extra: McpAuthExtra = { forbidden: error.message }

      return { ...base, extra }
    }

    throw error
  }
}

/** The 403 reason for an authenticated non-staff user, if this request is one. */
export function readForbiddenReason(auth?: AuthInfo): string | null {
  const extra = auth?.extra as McpAuthExtra | undefined

  return extra?.forbidden ?? null
}

/**
 * The principal behind a tool call. Throws rather than returning null: the
 * route rejects unauthenticated and forbidden requests before any tool runs,
 * so reaching a tool without one is a wiring bug, not a user error.
 */
export function requirePrincipal(auth?: AuthInfo): McpPrincipal {
  const extra = auth?.extra as McpAuthExtra | undefined

  if (!extra?.principal) {
    throw new Error('MCP tool reached without an authenticated principal.')
  }

  return extra.principal
}
