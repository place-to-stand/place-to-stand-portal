import 'server-only'

import { supabaseServiceClient } from '@pts/server/supabase'

import { getEnv } from '@/lib/env.server'

/**
 * Service-role client, for the admin auth API only: it mints one-time links
 * (`auth.admin.generateLink`) that we then mail ourselves.
 */
export function getSupabaseServiceClient() {
  const env = getEnv()
  return supabaseServiceClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  )
}
