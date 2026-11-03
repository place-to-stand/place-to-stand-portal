import 'server-only'

import { createSupabaseServerClient } from '@pts/server/supabase'

import { serverEnv } from '@/lib/env.server'

export function getSupabaseServerClient() {
  return createSupabaseServerClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
