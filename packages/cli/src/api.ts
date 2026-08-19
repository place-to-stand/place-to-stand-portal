export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export type ApiResult<T> = {
  data: T
  meta?: unknown
  warning?: string
}

type Envelope<T> =
  | { ok: true; data: T; meta?: unknown; warning?: string }
  | { ok: false; error: string; code?: string; details?: unknown }

export type RequestOptions = {
  method?: string
  body?: unknown
  token?: string
  query?: Record<string, string | number | string[] | undefined>
}

function buildUrl(
  apiUrl: string,
  path: string,
  query: RequestOptions['query']
): string {
  const url = new URL(path, `${apiUrl}/`)

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) {
      continue
    }

    if (Array.isArray(value)) {
      value.forEach(entry => url.searchParams.append(key, entry))
    } else {
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

/**
 * One request against the portal. Returns the raw `Response` alongside the
 * decoded envelope so callers can react to a 401 before it becomes an error.
 */
export async function request<T>(
  apiUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<{ response: Response; result?: ApiResult<T>; error?: ApiError }> {
  const response = await fetch(buildUrl(apiUrl, path, options.query), {
    method: options.method ?? 'GET',
    headers: {
      accept: 'application/json',
      ...(options.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    // Do not follow redirects. If the portal's proxy allowlist ever stops
    // exempting /api/cli, an unauthenticated call would 302 to /sign-in and a
    // followed redirect would hand back an HTML page with a 200 status.
    redirect: 'manual',
  })

  if (response.status >= 300 && response.status < 400) {
    return {
      response,
      error: new ApiError(
        `The portal redirected the request to ${response.headers.get('location') ?? 'an unknown location'}. ` +
          'This usually means /api/cli is missing from the portal proxy allowlist.',
        response.status
      ),
    }
  }

  let envelope: Envelope<T> | null = null

  try {
    envelope = (await response.json()) as Envelope<T>
  } catch {
    envelope = null
  }

  if (!envelope) {
    return {
      response,
      error: new ApiError(
        `The portal returned a non-JSON response (HTTP ${response.status}).`,
        response.status
      ),
    }
  }

  if (!envelope.ok) {
    return {
      response,
      error: new ApiError(
        envelope.error,
        response.status,
        envelope.code,
        envelope.details
      ),
    }
  }

  return {
    response,
    result: {
      data: envelope.data,
      meta: envelope.meta,
      warning: envelope.warning,
    },
  }
}

export type PortalMeta = {
  apiVersion: string
  supabaseUrl: string
  supabaseAnonKey: string
}

export async function fetchPortalMeta(apiUrl: string): Promise<PortalMeta> {
  const { result, error } = await request<PortalMeta>(
    apiUrl,
    'api/cli/v1/meta'
  )

  if (error) {
    throw error
  }

  return result!.data
}
