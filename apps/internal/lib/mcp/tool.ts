import 'server-only'

import type {
  CallToolResult,
  McpServer,
  ToolAnnotations,
} from '@modelcontextprotocol/server'
import { z, ZodError } from 'zod'

import { runAsAgent } from '@/lib/activity/agent-context'
import { roleCan, rolesWith } from '@/lib/auth/capabilities'
import { ROLE_LABELS } from '@/lib/auth/roles'
import type { AppUser } from '@/lib/auth/session'
import { errorCodeFor } from '@/lib/cli/handler'
import { ForbiddenError, HttpError } from '@/lib/errors/http'
import {
  captureServerEvent,
  captureServerException,
} from '@/lib/posthog/server'

import { requirePrincipal, type McpPrincipal } from './auth'
import { MCP_TOOL_CAPABILITIES, type McpToolName } from './tool-capabilities'

/**
 * The token check admits ADMIN and SALES (PRD 009 D6, revised 2026-10-27).
 * Each tool then needs the capability listed for it in
 * `MCP_TOOL_CAPABILITIES`, read from the same registry the portal's own
 * guards use (`lib/auth/capabilities.ts`). Within a tool, the data helpers it
 * calls still scope what a SALES user sees (e.g. `canReadActivity`).
 *
 * The server registers one tool list for every caller (the handler is built
 * once, before any token is read), so a tool the caller's role cannot use
 * is refused when called, with a message that names the tool and the roles
 * that can.
 */
function assertToolAccess(name: McpToolName, user: AppUser) {
  const capability = MCP_TOOL_CAPABILITIES[name]
  if (roleCan(user.role, capability)) return

  const roles = rolesWith(capability)
    .map(role => ROLE_LABELS[role].toLowerCase())
    .join(' and ')
  throw new ForbiddenError(
    `${name} is available to ${roles} users only; your role is ${ROLE_LABELS[user.role]}.`
  )
}

/** Agreed with Kris 2026-10-19 (PRD 009 §7). */
export const MCP_TOOL_CALLED_EVENT = 'mcp.tool_call'

export type ToolDefinition<Shape extends z.ZodRawShape> = {
  name: McpToolName
  title: string
  description: string
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

const ANNOTATIONS: Record<
  ToolDefinition<z.ZodRawShape>['effect'],
  ToolAnnotations
> = {
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
        assertToolAccess(definition.name, principal.user)

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
