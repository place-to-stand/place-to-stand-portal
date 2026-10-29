// permission: public — OAuth discovery metadata
import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from 'mcp-handler'

import { serverEnv } from '@/lib/env.server'

/**
 * RFC 9728 Protected Resource Metadata for `/api/mcp`: tells an MCP client
 * that Supabase Auth's OAuth 2.1 server issues tokens for it. The client
 * reads the authorization server's own metadata from there.
 */
export function GET(request: Request) {
  return protectedResourceHandler({
    authServerUrls: [authorizationServerUrl()],
  })(request)
}

/**
 * The issuer is `<supabase>/auth/v1`, and MCP clients discover its metadata
 * by RFC 8414 path insertion: `/.well-known/oauth-authorization-server/auth/v1`.
 * Hosted Supabase routes that path; the local CLI stack's gateway does not
 * (404), though it serves the same document at the bare origin. Locally we
 * advertise the origin so discovery lands on the path that exists.
 */
function authorizationServerUrl(): string {
  const supabaseUrl = serverEnv.NEXT_PUBLIC_SUPABASE_URL
  const { hostname } = new URL(supabaseUrl)
  const isLocalStack = hostname === '127.0.0.1' || hostname === 'localhost'

  return isLocalStack ? supabaseUrl : `${supabaseUrl}/auth/v1`
}

export const OPTIONS = metadataCorsOptionsRequestHandler()
