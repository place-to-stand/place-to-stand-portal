import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  convexAuthNextjsMiddleware,
  isAuthenticatedNextjs,
} from '@convex-dev/auth/nextjs/server'

import type { Database } from '@/lib/supabase/types'

// Feature flag check (read directly from env since this runs in edge runtime)
const USE_CONVEX_AUTH = process.env.NEXT_PUBLIC_USE_CONVEX_AUTH === 'true'

const PUBLIC_PATHS = new Set([
  '/sign-in',
  '/unauthorized',
  '/forgot-password',
  '/reset-password',
  '/api/integrations/leads-intake',
  '/auth/callback', // Convex Auth callback
  '/api/auth', // Convex Auth API route
])
const FORCE_RESET_PATH = '/force-reset-password'

/**
 * Convex Auth middleware handler
 * Handles /api/auth requests and auth state
 */
const convexAuthHandler = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const pathname = request.nextUrl.pathname
    const isPublic = [...PUBLIC_PATHS].some(path => pathname.startsWith(path))
    const isAuthenticated = await convexAuth.isAuthenticated()

    // Redirect unauthenticated users to sign-in
    if (!isAuthenticated && !isPublic) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/sign-in'
      redirectUrl.searchParams.set(
        'redirect',
        request.nextUrl.pathname + request.nextUrl.search
      )
      return NextResponse.redirect(redirectUrl)
    }

    // Redirect authenticated users away from sign-in
    if (isAuthenticated && pathname === '/sign-in') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return NextResponse.next()
  }
)

/**
 * Check authentication using Supabase Auth
 */
async function checkSupabaseAuth(req: NextRequest): Promise<{
  isAuthenticated: boolean
  mustResetPassword: boolean
  response: NextResponse
}> {
  const res = NextResponse.next()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies
            .getAll()
            .map(({ name, value }) => ({ name, value }))
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  // AuthSessionMissingError is expected for unauthenticated users - don't log it
  if (userError && userError.name !== 'AuthSessionMissingError') {
    console.error('Failed to resolve Supabase user in middleware', userError)
  }

  return {
    isAuthenticated: Boolean(user),
    mustResetPassword: Boolean(user?.user_metadata?.must_reset_password),
    response: res,
  }
}

export async function proxy(req: NextRequest, event: any) {
  const pathname = req.nextUrl.pathname

  // Use Convex Auth or Supabase Auth based on feature flag
  if (USE_CONVEX_AUTH) {
    // Delegate to Convex Auth middleware (handles /api/auth and auth state)
    return convexAuthHandler(req, event)
  }

  // Supabase Auth flow (existing behavior)
  const isPublic = [...PUBLIC_PATHS].some(path => pathname.startsWith(path))
  const { isAuthenticated, mustResetPassword, response } =
    await checkSupabaseAuth(req)

  if (!isAuthenticated && !isPublic) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/sign-in'
    redirectUrl.searchParams.set(
      'redirect',
      req.nextUrl.pathname + req.nextUrl.search
    )

    return NextResponse.redirect(redirectUrl)
  }

  if (
    isAuthenticated &&
    mustResetPassword &&
    !pathname.startsWith(FORCE_RESET_PATH)
  ) {
    const resetUrl = req.nextUrl.clone()
    resetUrl.pathname = FORCE_RESET_PATH
    resetUrl.searchParams.set(
      'redirect',
      req.nextUrl.pathname + req.nextUrl.search
    )

    return NextResponse.redirect(resetUrl)
  }

  if (isAuthenticated && pathname === '/sign-in') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|assets/|relay-HVAq/).*)',
  ],
}
