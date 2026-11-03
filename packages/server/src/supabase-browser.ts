'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/** The browser's Supabase client, one per page. */
export function supabaseBrowserClient(
  url: string,
  anonKey: string
): SupabaseClient {
  client ??= createBrowserClient(url, anonKey)
  return client
}
