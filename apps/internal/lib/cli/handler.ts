import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'

import type { AppUser } from '@/lib/auth/session'
import { BadRequestError, HttpError } from '@/lib/errors/http'

import { resolveCliUser } from './auth'

/**
 * `request.json()` throws a SyntaxError on a malformed body, which would
 * otherwise surface as a 500. It is a client mistake, so report it as one.
 */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new BadRequestError('Request body must be valid JSON.')
  }
}

export type CliHandlerArgs<TParams> = {
  user: AppUser
  request: NextRequest
  params: TParams
}

type RouteContext<TParams> = { params: Promise<TParams> }

type SuccessOptions = {
  status?: number
  /**
   * A partial success: the operation took effect but a follow-up step failed.
   * Carried alongside `ok: true` so callers do not retry a write that landed.
   */
  warning?: string
  meta?: unknown
}

const ERROR_CODES: Record<number, string> = {
  400: 'INVALID_INPUT',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
}

export function jsonOk<T>(data: T, options: SuccessOptions = {}) {
  const { status = 200, warning, meta } = options

  return NextResponse.json(
    {
      ok: true,
      data,
      ...(meta === undefined ? {} : { meta }),
      ...(warning === undefined ? {} : { warning }),
    },
    { status }
  )
}

function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code: ERROR_CODES[status] ?? 'INTERNAL_ERROR',
      ...(details === undefined ? {} : { details }),
    },
    { status }
  )
}

/**
 * Wraps a CLI route handler: resolves the admin behind the bearer token,
 * awaits route params, and renders both success and failure as the CLI
 * envelope. Every route under `/api/cli/` must go through this — the proxy
 * allowlist exempts the whole prefix from the cookie gate, so this is the only
 * thing standing between an anonymous request and the data.
 *
 * Handlers return plain data (wrapped in `{ ok: true, data }`) or a
 * `NextResponse` built with `jsonOk` when they need a status or warning.
 */
export function withCliAuth<TParams = Record<string, never>>(
  handler: (args: CliHandlerArgs<TParams>) => Promise<unknown>
) {
  return async (request: NextRequest, context?: RouteContext<TParams>) => {
    try {
      const user = await resolveCliUser(request)
      const params = context?.params
        ? await context.params
        : ({} as TParams)

      const result = await handler({ user, request, params })

      return result instanceof NextResponse ? result : jsonOk(result)
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonError(error.status, error.message)
      }

      if (error instanceof ZodError) {
        return jsonError(
          400,
          'Invalid request payload.',
          error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
          }))
        )
      }

      // Never surface a raw driver or runtime message to the caller — those
      // leak schema and connection detail. Log it, return something generic.
      console.error('Unhandled CLI API error', error)

      return jsonError(500, 'Internal server error.')
    }
  }
}
