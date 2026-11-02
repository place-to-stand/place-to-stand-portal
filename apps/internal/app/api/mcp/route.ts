import { createMcpHandler, withMcpAuth } from 'mcp-handler'

import {
  MCP_RESOURCE_METADATA_PATH,
  readForbiddenReason,
  verifyMcpToken,
} from '@/lib/mcp/auth'
import { registerMcpTools } from '@/lib/mcp/server'

/**
 * Remote MCP server (PRD 009). Stateless Streamable HTTP: every request is a
 * self-contained POST, authenticated by an OAuth access token issued by
 * Supabase Auth, so any function instance can serve any call.
 *
 * `/api/mcp` is on the proxy allowlist — the cookie gate would 302 an MCP
 * client to an HTML sign-in page — so `withMcpAuth` here is the only thing
 * between an anonymous request and the data.
 */
const mcpHandler = createMcpHandler(registerMcpTools, {
  serverInfo: { name: 'place-to-stand', version: '1.0.0' },
  // The tool list is fixed per deploy, so we never send list-changed
  // notices. Saying so matters: while `listChanged` is on (the SDK default),
  // a client's `subscriptions/listen` POST is held open with keepalives until
  // Vercel kills it at maxDuration (seen as 800s timeouts). Off, the SDK
  // acknowledges the subscription and closes the stream at once.
  capabilities: { tools: { listChanged: false } },
})

/** Every tool call is a few queries; nothing here should run for minutes. */
export const maxDuration = 60

const handler = withMcpAuth(
  async request => {
    const forbidden = readForbiddenReason(request.auth)

    if (forbidden) {
      return Response.json(
        {
          jsonrpc: '2.0',
          error: { code: -32001, message: forbidden },
          id: null,
        },
        { status: 403 }
      )
    }

    return mcpHandler(request)
  },
  verifyMcpToken,
  { required: true, resourceMetadataPath: MCP_RESOURCE_METADATA_PATH }
)

export { handler as GET, handler as POST, handler as DELETE }
