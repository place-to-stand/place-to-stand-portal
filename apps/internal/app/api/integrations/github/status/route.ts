import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { getActiveInstallationForProject } from '@/lib/github/app-installations'

export async function GET(request: NextRequest) {
  const user = await requireUser()
  const projectId = request.nextUrl.searchParams.get('projectId')

  // Fetch all GitHub accounts for this user (multi-account support)
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
        eq(oauthConnections.provider, 'GITHUB'),
        isNull(oauthConnections.deletedAt)
      )
    )
    .orderBy(oauthConnections.createdAt)

  // A project's client may have granted access via their own GitHub App
  // installation — distinct from the staff member's personal OAuth connection.
  const installation = projectId
    ? await getActiveInstallationForProject(projectId)
    : null

  return NextResponse.json({
    connected: connections.length > 0 || installation !== null,
    accounts: connections.map(c => ({
      id: c.id,
      email: c.providerEmail,
      displayName: c.displayName || c.providerEmail,
      login: (c.providerMetadata as { login?: string })?.login,
      status: c.status,
      scopes: c.scopes,
      lastSyncAt: c.lastSyncAt,
      connectedAt: c.createdAt,
      metadata: c.providerMetadata,
    })),
    appInstallation: installation
      ? {
          id: installation.id,
          accountLogin: installation.accountLogin,
          accountAvatarUrl: installation.accountAvatarUrl,
          repositorySelection: installation.repositorySelection,
        }
      : null,
  })
}
