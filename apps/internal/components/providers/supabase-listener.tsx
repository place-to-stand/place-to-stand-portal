'use client'

import { useEffect } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'

/**
 * Supabase Auth session listener.
 *
 * The browser client (`createBrowserClient` from @supabase/ssr) stores the
 * session in the same cookies the server reads, and refreshes it itself when
 * it nears expiry. This component only handles the case that client can't:
 * a tab coming back from the background with a session that was revoked
 * while it slept.
 *
 * Don't force `refreshSession()` on mount or mirror auth events to the
 * server: cookie storage already covers both, and each would cost a token
 * rotation plus `GET /user` calls on every full page load.
 */
export function SupabaseListener() {
  const supabase = getSupabaseBrowserClient()

  // Check the session when the page becomes visible again (after sleep).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void supabase.auth
          .getSession()
          .then(({ data: { session } }) => {
            if (session) {
              // Still signed in: the client refreshes the token itself.
              return
            }
            // If no session, redirect to login
            if (
              typeof window !== 'undefined' &&
              window.location.pathname !== '/sign-in' &&
              !window.location.pathname.startsWith('/share/')
            ) {
              // Full reload on session loss drops all client state and
              // re-runs the proxy — router.push would keep stale trees.
              // oxlint-disable-next-line next-js/no-location-assign-relative-destination -- a full reload on session loss drops stale client state
              window.location.href = '/sign-in'
            }
          })
          .catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [supabase])

  return null
}
