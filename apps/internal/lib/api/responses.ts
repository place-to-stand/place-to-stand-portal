import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'

/**
 * Standardized API response format for consistent client handling.
 */

export interface ApiSuccessResponse<T = unknown> {
  ok: true
  data?: T
}

export interface ApiErrorResponse {
  ok: false
  error: string
  code?: string
  details?: unknown
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Create a success response with data
 */
export function apiSuccess<T>(data?: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ ok: true, data } as ApiSuccessResponse<T>)
}

/**
 * Create a success response with custom shape (for backwards compatibility)
 */
export function apiOk<T extends Record<string, unknown>>(
  payload: T
): NextResponse<T & { ok: true }> {
  return NextResponse.json({ ...payload, ok: true } as T & { ok: true })
}

/**
 * Create an error response
 */
export function apiError(
  message: string,
  status: number = 500,
  options?: { code?: string; details?: unknown }
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    ok: false,
    error: message,
  }

  if (options?.code) {
    response.code = options.code
  }
  if (options?.details) {
    response.details = options.details
  }

  return NextResponse.json(response, { status })
}

/**
 * Create a 400 Bad Request error
 */
export function apiBadRequest(
  message: string = 'Bad request',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return apiError(message, 400, { code: 'BAD_REQUEST', details })
}

/**
 * Create a 401 Unauthorized error
 */
export function apiUnauthorized(
  message: string = 'Unauthorized'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 401, { code: 'UNAUTHORIZED' })
}

/**
 * Create a 403 Forbidden error
 */
export function apiForbidden(
  message: string = 'Forbidden'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 403, { code: 'FORBIDDEN' })
}

/**
 * Create a 404 Not Found error
 */
export function apiNotFound(
  resource: string = 'Resource'
): NextResponse<ApiErrorResponse> {
  return apiError(`${resource} not found`, 404, { code: 'NOT_FOUND' })
}

/**
 * Create a validation error from Zod error
 */
export function apiValidationError(
  error: ZodError
): NextResponse<ApiErrorResponse> {
  return apiError('Validation failed', 400, {
    code: 'VALIDATION_ERROR',
    details: error.flatten(),
  })
}

/**
 * Create a 500 Internal Server Error
 */
export function apiInternalError(
  message: string = 'Internal server error'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 500, { code: 'INTERNAL_ERROR' })
}
