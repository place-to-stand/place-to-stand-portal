import 'server-only'

import { and, eq, isNull, ne } from 'drizzle-orm'

import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { createNotifications } from '@/lib/notifications/in-app/queries'

/**
 * Mark a connection as needing re-authentication
 */
export async function markConnectionNeedsReauth(
  connectionId: string,
  reason: string
): Promise<void> {
  const syncState = {
    lastError: reason,
    lastErrorAt: new Date().toISOString(),
    needsReauth: true,
  }

  // Conditional, so only the call that breaks it tells the owner: later
  // failed tries find it already waiting.
  const flipped = await db
    .update(oauthConnections)
    .set({
      status: 'PENDING_REAUTH',
      syncState,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(oauthConnections.id, connectionId),
        // Not one disconnected while a sync was running: that's on purpose.
        isNull(oauthConnections.deletedAt),
        ne(oauthConnections.status, 'REVOKED'),
        ne(oauthConnections.status, 'PENDING_REAUTH')
      )
    )
    .returning({
      userId: oauthConnections.userId,
      email: oauthConnections.providerEmail,
    })

  const [owner] = flipped
  if (!owner) return
  await createNotifications([
    {
      userId: owner.userId,
      type: 'connection_reauth',
      title: 'Reconnect your Google account',
      body: `${owner.email ?? 'Your Google account'} stopped working. Lead emails won’t sync until you reconnect it.`,
      href: '/my/home?account=integrations',
    },
  ]).catch(error => {
    console.error('Failed to notify about a broken connection', error)
  })
}
