import type { Instrumentation } from 'next'

// Server-side render, route handler, and server action errors. The browser
// only ever sees a sanitized message plus `digest`, so this is the one place
// the real message and stack exist outside Vercel's short log retention.
//
// Reads process.env directly: lib/env.server.ts imports 'server-only', which
// throws outside the react-server layer that instrumentation runs in.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!key || !host) return

  try {
    const { PostHog } = await import('posthog-node')
    const client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 })

    const err = error as Error & { digest?: string }
    // Returns void; shutdown() awaits the pending capture and flushes it.
    client.captureException(err, distinctIdFromCookie(request.headers, key), {
      digest: err.digest,
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    })
    await client.shutdown()
  } catch (reportError) {
    console.error('Failed to report request error to PostHog', reportError)
  }
}

/** Ties the server exception to the browser person via posthog-js's cookie. */
function distinctIdFromCookie(
  headers: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const raw = headers.cookie
  const cookieHeader = Array.isArray(raw) ? raw.join('; ') : raw
  if (!cookieHeader) return undefined

  const name = `ph_${key}_posthog=`
  const match = cookieHeader.split(/;\s*/).find(part => part.startsWith(name))
  if (!match) return undefined

  try {
    const parsed = JSON.parse(decodeURIComponent(match.slice(name.length)))
    return typeof parsed?.distinct_id === 'string' ? parsed.distinct_id : undefined
  } catch {
    return undefined
  }
}
