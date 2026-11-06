import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { authorizeRoute } from '@/lib/auth/guard'

export async function GET() {
  const { user, denied } = await authorizeRoute('integrations.google')
  if (denied) return denied

  // Fetch all Google accounts for this user (multi-account support)
  const connections = await db
    .select({
      id: oauthConnections.id,
      status: oauthConnections.status,
      providerEmail: oauthConnections.providerEmail,
      displayName: oauthConnections.displayName,
      providerAccountId: oauthConnections.providerAccountId,
      scopes: oauthConnections.scopes,
      lastSyncAt: oauthConnections.lastSyncAt,
      createdAt: oauthConnections.createdAt,
      providerMetadata: oauthConnections.providerMetadata,
    })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, user.id),
        eq(oauthConnections.provider, 'GOOGLE'),
        isNull(oauthConnections.deletedAt)
      )
    )
    .orderBy(oauthConnections.createdAt)

  if (connections.length === 0) {
    return NextResponse.json({ connected: false, accounts: [] })
  }

  return NextResponse.json({
    connected: true,
    accounts: connections.map(c => ({
      id: c.id,
      email: c.providerEmail,
      displayName: c.displayName || c.providerEmail,
      status: c.status,
      scopes: c.scopes,
      lastSyncAt: c.lastSyncAt,
      connectedAt: c.createdAt,
      metadata: c.providerMetadata,
    })),
  })
}
