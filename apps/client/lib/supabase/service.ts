import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { getEnv } from '@/lib/env.server'

let client: SupabaseClient | null = null

/**
 * Service-role client, for the admin auth API only.
 *
 * The portal reads data through Drizzle and its own scoping helpers, so this
 * exists purely to mint one-time links (`auth.admin.generateLink`) that we then
 * mail ourselves. It bypasses every check Supabase would otherwise apply —
 * never hand it a value that came from a request without validating first.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!client) {
    const env = getEnv()

    client = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  }

  return client
}
