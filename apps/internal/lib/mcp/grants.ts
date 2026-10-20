import 'server-only'

import { getSupabaseServerClient } from '@/lib/supabase/server'

/** An app the signed-in user has connected to the portal (PRD 009 §6). */
export type ConnectedApp = {
  clientId: string
  name: string
  grantedAt: string
}

/**
 * auth-js types an OAuth client as `{ id, name }`, but the auth server
 * bundled with the local Supabase CLI returns `{ client_id, client_name }`.
 * Read both so the consent page and the connected-apps card never show
 * "undefined".
 */
export function oauthClientName(client: object): string {
  const { name, client_name } = client as {
    name?: string
    client_name?: string
  }

  return name || client_name || 'an app'
}

function oauthClientId(client: object): string {
  const { id, client_id } = client as { id?: string; client_id?: string }

  return id || client_id || ''
}

/**
 * Grants belong to the user, so both calls run with their own session
 * cookie, never the service key: a user can only list and revoke their own.
 */
export async function listConnectedApps(): Promise<ConnectedApp[]> {
  const { data, error } =
    await getSupabaseServerClient().auth.oauth.listGrants()

  if (error) {
    throw error
  }

  return data
    .map(grant => ({
      clientId: oauthClientId(grant.client),
      name: oauthClientName(grant.client),
      grantedAt: grant.granted_at,
    }))
    .filter(app => app.clientId)
}

/**
 * Revoking deletes the app's sessions and refresh tokens. `/api/mcp` checks
 * the session on every call (`auth.getUser`), so the app loses access at
 * once rather than when its access token expires.
 */
export async function revokeConnectedApp(clientId: string): Promise<void> {
  const { error } = await getSupabaseServerClient().auth.oauth.revokeGrant({
    clientId,
  })

  if (error) {
    throw error
  }
}
