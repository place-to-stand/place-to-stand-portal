import { NextResponse } from 'next/server'

import { CLI_API_VERSION } from '@/lib/cli/constants'
import { serverEnv } from '@/lib/env.server'

/**
 * The one unauthenticated route in the CLI namespace — it has to be, since the
 * client calls it *before* it can sign in, to learn which Supabase project to
 * authenticate against. That keeps `pts` configuration down to a single value
 * (the portal URL) instead of three.
 *
 * Both values returned here are `NEXT_PUBLIC_` and already embedded in every
 * browser bundle the portal serves, so publishing them costs nothing.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      apiVersion: CLI_API_VERSION,
      supabaseUrl: serverEnv.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  })
}
