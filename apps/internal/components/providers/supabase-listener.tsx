'use client';

import { useEffect } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Supabase Auth session listener.
 *
 * The browser client (`createBrowserClient` from @supabase/ssr) stores the
 * session in the same cookies the server reads, and refreshes it itself when
 * it nears expiry. This component only handles the case that client can't:
 * a tab coming back from the background with a session that was revoked
 * while it slept.
 *
 * It used to also force a `refreshSession()` on every mount and mirror every
 * auth event to `POST /auth/callback`, which cost a token rotation plus two
 * `GET /user` calls per full page load — all redundant with cookie storage.
 */
export function SupabaseListener() {
  const supabase = getSupabaseBrowserClient();

  // Refresh session when page becomes visible
  // This handles computer sleep/wake scenarios
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Verify and refresh session when page becomes visible
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            // Session exists and is valid, Supabase will auto-refresh if needed
            return;
          }
          // If no session, redirect to login
          if (
            typeof window !== 'undefined' &&
            window.location.pathname !== '/sign-in' &&
            !window.location.pathname.startsWith('/share/')
          ) {
            // Full reload on session loss drops all client state and
            // re-runs middleware — router.push would keep stale trees.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = '/sign-in';
          }
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabase]);

  return null;
}
