import 'server-only'

import { createSupabaseServerClient } from '@pts/server/supabase'

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not set')
  }

  return createSupabaseServerClient(url, anonKey)
}
