import { decryptToken, encryptToken } from '@/lib/oauth/encryption'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { refreshAccessToken } from '@/lib/oauth/google'
import { markConnectionNeedsReauth } from '@/lib/oauth/needs-reauth'

export { markConnectionNeedsReauth }

/**
 * Error thrown when OAuth token refresh fails and user needs to reconnect
 */
export class OAuthReconnectRequiredError extends Error {
  constructor(
    message: string,
    public readonly connectionId: string,
    public readonly provider: string = 'GOOGLE'
  ) {
    super(message)
    this.name = 'OAuthReconnectRequiredError'
  }
}

type GetAccessTokenResult = {
  accessToken: string
  expiresAt?: Date | null
  connectionId: string
}

async function getGoogleConnection(userId: string, connectionId?: string) {
  if (connectionId) {
    // Get specific connection by ID
    const [row] = await db
      .select()
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.id, connectionId),
          eq(oauthConnections.userId, userId),
          eq(oauthConnections.provider, 'GOOGLE'),
          isNull(oauthConnections.deletedAt)
        )
      )
      .limit(1)
    return row ?? null
  }

  // Fall back to first connected account
  const [row] = await db
    .select()
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, 'GOOGLE'),
        isNull(oauthConnections.deletedAt)
      )
    )
    .limit(1)
  return row ?? null
}

export async function getValidAccessToken(
  userId: string,
  connectionId?: string
): Promise<GetAccessTokenResult> {
  const conn = await getGoogleConnection(userId, connectionId)
  if (!conn) throw new Error('Google account not connected')

  // Check if connection is already marked as needing reauth
  if (
    conn.status === 'EXPIRED' ||
    conn.status === 'REVOKED' ||
    conn.status === 'PENDING_REAUTH'
  ) {
    throw new OAuthReconnectRequiredError(
      'Gmail connection needs to be reconnected',
      conn.id,
      'GOOGLE'
    )
  }

  const now = Date.now()
  const exp = conn.accessTokenExpiresAt
    ? new Date(conn.accessTokenExpiresAt).getTime()
    : undefined
  const needsRefresh = !!exp && exp - now < 5 * 60 * 1000 // under 5 minutes left

  if (!needsRefresh) {
    return {
      accessToken: decryptToken(conn.accessToken),
      expiresAt: exp ? new Date(exp) : null,
      connectionId: conn.id,
    }
  }

  if (!conn.refreshToken) {
    // No refresh token - mark as needing reauth and throw
    await markConnectionNeedsReauth(conn.id, 'No refresh token available')
    throw new OAuthReconnectRequiredError(
      'Gmail connection expired and cannot be refreshed',
      conn.id,
      'GOOGLE'
    )
  }

  try {
    const refreshed = await refreshAccessToken(decryptToken(conn.refreshToken))
    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString()
    const newEncryptedAccess = encryptToken(refreshed.access_token)

    await db
      .update(oauthConnections)
      .set({
        accessToken: newEncryptedAccess,
        accessTokenExpiresAt: newExpiresAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(oauthConnections.id, conn.id))

    return {
      accessToken: refreshed.access_token,
      expiresAt: new Date(newExpiresAt),
      connectionId: conn.id,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    // Only Google refusing the refresh token means the owner must reconnect.
    // An outage, rate limit or network error is retried on the next sync.
    if (!/invalid_grant|unauthorized_client/.test(errorMessage)) throw error
    await markConnectionNeedsReauth(conn.id, errorMessage)
    throw new OAuthReconnectRequiredError(
      `Gmail token refresh failed: ${errorMessage}`,
      conn.id,
      'GOOGLE'
    )
  }
}
