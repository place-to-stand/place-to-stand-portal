import { ApiError, request, type ApiResult, type RequestOptions } from './api.js'
import { refreshCredentials } from './auth.js'
import { readCredentials } from './config.js'
import { resolveApiContext } from './context.js'

const NOT_SIGNED_IN = 'Not signed in. Run `pts login`.'

/**
 * An authenticated call, with a single transparent token refresh.
 *
 * Access tokens are short-lived, so an expired one is the common case rather
 * than an error worth surfacing — refresh once and retry. A second 401 means
 * the refresh token is gone too, and the user has to sign in again.
 */
async function authedRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const apiUrl = await resolveApiContext()
  const credentials = await readCredentials(apiUrl)

  if (!credentials) {
    throw new ApiError(NOT_SIGNED_IN, 401)
  }

  const first = await request<T>(apiUrl, path, {
    ...options,
    token: credentials.accessToken,
  })

  if (first.result) {
    return first.result
  }

  if (first.error?.status !== 401) {
    throw first.error
  }

  const refreshed = await refreshCredentials(apiUrl, credentials)

  if (!refreshed) {
    throw new ApiError(`Session expired. ${NOT_SIGNED_IN}`, 401)
  }

  const retry = await request<T>(apiUrl, path, {
    ...options,
    token: refreshed.accessToken,
  })

  if (retry.error) {
    throw retry.error
  }

  return retry.result!
}

export function apiGet<T>(
  path: string,
  query?: RequestOptions['query']
): Promise<ApiResult<T>> {
  return authedRequest<T>(path, { query })
}

export function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return authedRequest<T>(path, { method: 'POST', body })
}

export function apiPatch<T>(
  path: string,
  body: unknown
): Promise<ApiResult<T>> {
  return authedRequest<T>(path, { method: 'PATCH', body })
}
