import 'server-only'

import type {
  CallToolResult,
  McpServer,
  ToolAnnotations,
} from '@modelcontextprotocol/server'
import { z, ZodError } from 'zod'

import { runAsAgent } from '@/lib/activity/agent-context'
import { assertAdmin, assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { errorCodeFor } from '@/lib/cli/handler'
import { HttpError } from '@/lib/errors/http'
import {
  captureServerEvent,
  captureServerException,
} from '@/lib/posthog/server'

import { requirePrincipal, type McpPrincipal } from './auth'

/**
 * `crm` tools are the ones a SALES user may one day reach (`assertCrmAccess`).
 * v1 admits ADMIN only at the token check (PRD 009 D6), so today both tags
 * pass the same users; the tag is here so admitting SALES is a config change.
 */
export type ToolAccess = 'admin' | 'crm'

const ACCESS_CHECKS: Record<ToolAccess, (user: AppUser) => void> = {
  admin: assertAdmin,
  crm: assertCrmAccess,
}

/** Agreed with Kris 2026-10-19 (PRD 009 §7). */
export const MCP_TOOL_CALLED_EVENT = 'mcp.tool_call'

export type ToolDefinition<Shape extends z.ZodRawShape> = {
  name: string
  title: string
  description: string
  access: ToolAccess
  input: Shape
  /**
   * Writes are never destructive — v1 has no delete, archive or restore — so
   * the only annotation that varies between them is idempotency.
   */
  effect: 'read' | 'write' | 'idempotent-write'
  run: (
    args: z.output<z.ZodObject<Shape>>,
    principal: McpPrincipal
  ) => Promise<Record<string, unknown>>
}

const ANNOTATIONS: Record<ToolDefinition<z.ZodRawShape>['effect'], ToolAnnotations> = {
  read: { readOnlyHint: true, openWorldHint: false },
  write: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  'idempotent-write': {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
}

type ToolFailure = { code: string; message: string }

/**
 * Same rule as `withCliAuth`: an `HttpError` is written for the caller and
 * passes through; anything else is a bug whose message may carry schema or
 * connection detail, so the agent gets a generic line and we get the error.
 */
function toToolFailure(error: unknown): ToolFailure {
  if (error instanceof HttpError) {
    return { code: errorCodeFor(error.status), message: error.message }
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0]
    const path = issue?.path.join('.')

    return {
      code: 'INVALID_INPUT',
      message: issue
        ? `${path ? `${path}: ` : ''}${issue.message}`
        : 'Invalid input.',
    }
  }

  return { code: 'INTERNAL_ERROR', message: 'Internal server error.' }
}

/**
 * Tool output is the CLI serializer's camelCase shape, returned both as text
 * (for clients that only read `content`) and as `structuredContent`.
 */
function jsonResult(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}

/**
 * Register one tool. Every tool goes through here so the access check, the
 * agent attribution on activity rows, error shaping and the PostHog event are
 * never forgotten on one of them.
 */
export function defineTool<Shape extends z.ZodRawShape>(
  server: McpServer,
  definition: ToolDefinition<Shape>
) {
  server.registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      inputSchema: z.object(definition.input),
      annotations: ANNOTATIONS[definition.effect],
    },
    async (args, ctx) => {
      const principal = requirePrincipal(ctx.http?.authInfo)
      const startedAt = performance.now()
      let failure: ToolFailure | null = null

      try {
        ACCESS_CHECKS[definition.access](principal.user)

        const data = await runAsAgent(principal.agent, () =>
          definition.run(args, principal)
        )

        return jsonResult(data)
      } catch (error) {
        failure = toToolFailure(error)

        if (failure.code === 'INTERNAL_ERROR') {
          console.error(`Unhandled MCP tool error in ${definition.name}`, error)
          captureServerException(error, {
            distinctId: principal.user.id,
            properties: { tool: definition.name },
          })
        }

        return {
          content: [{ type: 'text', text: failure.message }],
          isError: true,
        }
      } finally {
        captureServerEvent(MCP_TOOL_CALLED_EVENT, {
          distinctId: principal.user.id,
          properties: {
            tool: definition.name,
            outcome: failure ? 'error' : 'ok',
            error_code: failure?.code ?? null,
            duration_ms: Math.round(performance.now() - startedAt),
            agent_name: principal.agent.name,
          },
        })
      }
    }
  )
}
