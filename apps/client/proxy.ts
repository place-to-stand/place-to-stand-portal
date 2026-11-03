import { NextResponse, type NextRequest } from 'next/server'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Cross-site request forgery guard for the cookie-authenticated API routes,
 * the same check the internal portal's proxy makes.
 *
 * Server actions get an Origin check from Next.js itself; route handlers do
 * not. The Supabase cookie is SameSite=Lax, which already keeps it off
 * cross-site POSTs, so this is defence in depth: a state-changing request
 * with an Origin from another site is rejected. Requests with no Origin
 * (GitHub's webhook, curl) pass through to their own checks.
 */
function isCrossSiteMutation(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method)) return false
  const origin = req.headers.get('origin')
  if (!origin) return false

  // Compare hosts, not full origins: Vercel's edge terminates TLS, so the
  // scheme the browser saw and the one this request carries can differ.
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return true
  }
  const requestHost =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  return originHost !== requestHost
}

export function proxy(req: NextRequest) {
  if (isCrossSiteMutation(req)) {
    return NextResponse.json(
      { ok: false, error: 'Cross-site request rejected' },
      { status: 403 }
    )
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
