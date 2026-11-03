import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** The request's Supabase client, reading and writing the session cookies. */
export function createSupabaseServerClient(url: string, anonKey: string) {
  return createServerClient(url, anonKey, {
    auth: {
      // No auto-refresh on the server: reading an expired token from cookies
      // would warn about a negative timeout. The browser refreshes it.
      autoRefreshToken: false,
    },
    cookies: {
      async getAll() {
        const store = await cookies()
        return store.getAll().map(({ name, value }) => ({ name, value }))
      },
      async setAll(cookiesToSet) {
        try {
          const store = await cookies()
          cookiesToSet.forEach(({ name, value, options }) => {
            store.set({ name, value, ...options })
          })
        } catch (error) {
          const cookieNames = cookiesToSet.map(({ name }) => name)
          console.warn('Unable to apply cookies on server', {
            cookieNames,
            error,
          })
        }
      },
    },
  })
}

let serviceClient: SupabaseClient | null = null

/**
 * Service-role client, one per process. It bypasses every check Supabase
 * would otherwise apply: never hand it a value from a request without
 * validating it first.
 */
export function supabaseServiceClient(
  url: string,
  serviceRoleKey: string
): SupabaseClient {
  serviceClient ??= createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return serviceClient
}
