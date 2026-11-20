import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'

import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { decryptToken } from '@/lib/oauth/encryption'
import { revokeToken } from '@/lib/oauth/github'
import { logActivity } from '@/lib/activity/logger'
import { oauthDisconnectedEvent } from '@/lib/activity/events'
import { authorizeRoute } from '@/lib/auth/guard'

export async function POST(request: Request) {
  const { user, denied } = await authorizeRoute('integrations.personal')
  if (denied) return denied

  // Get connectionId from request body (multi-account support)
  const body = await request.json().catch(() => ({}))
  const { connectionId } = body as { connectionId?: string }

  if (!connectionId) {
    return NextResponse.json(
      { error: 'connectionId is required' },
      { status: 400 }
    )
  }

  // Get specific connection (verify ownership)
  const [connection] = await db
    .select()
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.id, connectionId),
        eq(oauthConnections.userId, user.id),
        eq(oauthConnections.provider, 'GITHUB')
      )
    )
    .limit(1)

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const login = (connection.providerMetadata as { login?: string })?.login

  // Read before the soft delete clears it; a bad ciphertext just skips the
  // revoke.
  let revokedToken: string | null = null
  try {
    revokedToken = decryptToken(connection.accessToken)
  } catch {}

  // Soft delete and drop the ciphertext: a disconnected row must not keep a
  // working credential around (matches lib/integrations/connections.ts).
  await db
    .update(oauthConnections)
    .set({
      accessToken: '',
      refreshToken: null,
      status: 'REVOKED',
      deletedAt: new Date().toISOString(),
    })
    .where(eq(oauthConnections.id, connection.id))

  // Then revoke the token at GitHub (best effort). After the soft delete, so a
  // request that sees the revoked token can't read it as a broken connection
  // and send its owner a Reconnect notice.
  try {
    if (revokedToken) await revokeToken(revokedToken)
  } catch (error) {
    // Log for monitoring; the connection is already soft-deleted.
    console.error('[OAuth Disconnect] Failed to revoke GitHub token:', {
      userId: user.id,
      connectionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  const event = oauthDisconnectedEvent({
    provider: 'GITHUB',
    accountLabel: login ?? connection.displayName,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'SETTINGS',
    targetId: user.id,
    metadata: event.metadata,
  })

  return NextResponse.json({ success: true })
}
