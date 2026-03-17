import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not set')
  }

  return createServerClient(url, anonKey, {
    auth: {
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
