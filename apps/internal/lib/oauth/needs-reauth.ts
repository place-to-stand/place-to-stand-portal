import 'server-only'

import { and, eq, isNull, ne, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { createNotifications } from '@/lib/notifications/in-app/queries'

/** What stops working while each provider's connection is broken. */
const WHAT_STOPS: Record<string, { name: string; stops: string }> = {
  GOOGLE: { name: 'Google', stops: 'Lead emails won’t sync' },
  GITHUB: { name: 'GitHub', stops: 'Repos and pull requests won’t load' },
  VERCEL: { name: 'Vercel', stops: 'Vercel projects won’t load' },
  SUPABASE: { name: 'Supabase', stops: 'Supabase projects won’t load' },
}

/**
 * Marks a saved connection as broken (the provider refused it) and tells
 * its owner, once, in a notification that links to where they reconnect.
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
      provider: oauthConnections.provider,
      label: sql<
        string | null
      >`coalesce(${oauthConnections.providerEmail}, ${oauthConnections.displayName})`,
    })

  const [owner] = flipped
  if (!owner) return
  const copy = WHAT_STOPS[owner.provider] ?? {
    name: owner.provider,
    stops: 'It won’t work',
  }
  await createNotifications([
    {
      userId: owner.userId,
      type: 'connection_reauth',
      title: `Reconnect ${copy.name}`,
      body: `${owner.label ?? copy.name} stopped working. ${copy.stops} until you reconnect it.`,
      href: '/my/home?account=integrations',
    },
  ]).catch(error => {
    console.error('Failed to notify about a broken connection', error)
  })
}
