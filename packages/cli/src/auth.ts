import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { ApiError, fetchPortalMeta } from './api.js'
import { writeCredentials, type StoredCredentials } from './config.js'

/**
 * Authentication happens directly against Supabase rather than through the
 * portal: the portal never sees the password, and token refresh is Supabase's
 * problem rather than something we reimplement. The portal only ever receives
 * the resulting access token as a bearer credential.
 */
async function createSupabaseClient(apiUrl: string): Promise<SupabaseClient> {
  const meta = await fetchPortalMeta(apiUrl)

  return createClient(meta.supabaseUrl, meta.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function signIn(
  apiUrl: string,
  email: string,
  password: string
): Promise<StoredCredentials> {
  const supabase = await createSupabaseClient(apiUrl)
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new ApiError(error.message, error.status ?? 401)
  }

  if (!data.session) {
    throw new ApiError('Sign-in did not return a session.', 401)
  }

  const credentials: StoredCredentials = {
    email,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  }

  await writeCredentials(apiUrl, credentials)

  return credentials
}

/**
 * Exchange a stored refresh token for a fresh access token. Returns null when
 * the refresh token itself has expired or been revoked — the caller should
 * then ask the user to sign in again rather than retrying.
 */
export async function refreshCredentials(
  apiUrl: string,
  credentials: StoredCredentials
): Promise<StoredCredentials | null> {
  const supabase = await createSupabaseClient(apiUrl)
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: credentials.refreshToken,
  })

  if (error || !data.session) {
    return null
  }

  const refreshed: StoredCredentials = {
    email: credentials.email,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  }

  await writeCredentials(apiUrl, refreshed)

  return refreshed
}
