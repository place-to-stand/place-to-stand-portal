'use client';

import { useEffect } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CONVEX_FLAGS } from "@/lib/feature-flags";

type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

interface Props {
  initialSession: SessionTokens | null;
}

/**
 * Supabase Auth session listener
 *
 * Handles session refresh and visibility change events for Supabase Auth.
 * This component is disabled when Convex Auth is enabled via feature flag.
 */
export function SupabaseListener({ initialSession }: Props) {
  // When Convex Auth is enabled, skip Supabase initialization entirely
  // to avoid creating unnecessary Supabase client connections
  const isConvexAuth = CONVEX_FLAGS.AUTH;
  const supabase = isConvexAuth ? null : getSupabaseBrowserClient();

  // Subscribe to auth state changes (Supabase only)
  useEffect(() => {
    if (isConvexAuth || !supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      const tokens = currentSession
        ? {
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token,
          }
        : null;

      void fetch("/auth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event: _event, session: tokens }),
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, isConvexAuth]);

  // Refresh session on mount (Supabase only)
  useEffect(() => {
    if (isConvexAuth || !supabase || !initialSession) return;

    // Immediately refresh the session to avoid negative timeout warnings
    // when the token has expired while the app was idle
    void supabase.auth.refreshSession({
      refresh_token: initialSession.refresh_token,
    }).then(({ error }) => {
      if (error) {
        // Fallback to setSession if refresh fails
        void supabase.auth.setSession({
          access_token: initialSession.access_token,
          refresh_token: initialSession.refresh_token,
        });
      }
    });
  }, [initialSession, supabase, isConvexAuth]);

  // Refresh session when page becomes visible (Supabase only)
  // This handles computer sleep/wake scenarios
  useEffect(() => {
    if (isConvexAuth || !supabase) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Verify and refresh session when page becomes visible
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            // Session exists and is valid, Supabase will auto-refresh if needed
            return;
          }
          // If no session, redirect to login
          if (typeof window !== 'undefined' && window.location.pathname !== '/sign-in') {
            window.location.href = '/sign-in';
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabase, isConvexAuth]);

  return null;
}
