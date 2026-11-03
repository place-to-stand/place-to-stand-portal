import 'server-only'

import { NextResponse } from 'next/server'

import { roleCan, type Capability } from '@/lib/auth/capabilities'
import { getCurrentUser, type AppUser } from '@/lib/auth/session'

type RouteAuth =
  { user: AppUser; denied: null } | { user: null; denied: NextResponse }

/**
 * The API route guard. Answers JSON, never a redirect, so a `fetch` caller
 * gets a 401 (no session) or 403 (role lacks `capability`) it can read:
 *
 *   const { user, denied } = await authorizeRoute('billing.manage')
 *   if (denied) return denied
 *
 * Pages use `requirePage` (`lib/auth/session.ts`) instead. Browser
 * navigations under `app/api/auth/**` (OAuth starts and callbacks) keep the
 * redirecting page guards, because a person is looking at them.
 */
export async function authorizeRoute(
  capability: Capability
): Promise<RouteAuth> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      user: null,
      denied: NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }
  if (!roleCan(user.role, capability)) {
    return {
      user: null,
      denied: NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      ),
    }
  }
  return { user, denied: null }
}
