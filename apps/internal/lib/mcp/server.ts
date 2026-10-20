import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { serializeUser } from '@/lib/cli/serializers/user'

import { requirePrincipal } from './auth'

/**
 * Tool output is the CLI serializer's camelCase shape, returned both as text
 * (for clients that only read `content`) and as `structuredContent`.
 */
function jsonResult<T extends Record<string, unknown>>(data: T) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}

export function registerMcpTools(server: McpServer) {
  server.registerTool(
    'whoami',
    {
      title: 'Who am I',
      description:
        'Return the Place To Stand portal user this connection acts as, and the app it is connected through.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (_args, ctx) => {
      const { user, agent } = requirePrincipal(ctx.http?.authInfo)

      return jsonResult({ user: serializeUser(user), agent })
    }
  )
}
