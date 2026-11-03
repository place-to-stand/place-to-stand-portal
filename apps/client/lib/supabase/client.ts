'use client'

import { supabaseBrowserClient } from '@pts/server/supabase-browser'

import { env } from '@/lib/env'

export function getSupabaseBrowserClient() {
  return supabaseBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
