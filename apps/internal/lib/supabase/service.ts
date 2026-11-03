import 'server-only'

import { supabaseServiceClient } from '@pts/server/supabase'

import { serverEnv } from '@/lib/env.server'

/** Service-role client, for the admin auth API. */
export function getSupabaseServiceClient() {
  return supabaseServiceClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY
  )
}
