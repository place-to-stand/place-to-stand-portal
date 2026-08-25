import 'server-only'

import { cache } from 'react'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users, oauthConnections } from '@pts/db/schema'

export interface PtsStaffGitHubAccount {
  userId: string
  name: string
  email: string
  githubLogin: string
}

/**
 * PTS admin staff who have connected their own GitHub account — the list a
 * client adds as repo collaborators for human code review. Distinct from the
 * GitHub App installation, which only grants bot/API access.
 *
 * Sourced from each staff member's own oauth_connections row rather than a
 * hardcoded list, so it stays correct as staff join, leave, or reconnect
 * GitHub without a code change.
 */
export const fetchPtsStaffGitHubAccounts = cache(
  async (): Promise<PtsStaffGitHubAccount[]> => {
    const rows = await db
      .select({
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        providerMetadata: oauthConnections.providerMetadata,
      })
      .from(users)
      .innerJoin(
        oauthConnections,
        and(
          eq(oauthConnections.userId, users.id),
          eq(oauthConnections.provider, 'GITHUB'),
          eq(oauthConnections.status, 'ACTIVE'),
          isNull(oauthConnections.deletedAt)
        )
      )
      .where(
        and(
          eq(users.role, 'ADMIN'),
          isNull(users.deletedAt),
          isNull(users.disabledAt)
        )
      )

    return rows
      .map(r => {
        const metadata = r.providerMetadata as { login?: string; name?: string }
        const githubLogin = metadata?.login ?? ''
        return {
          userId: r.userId,
          // Prefer the PTS profile name, then the name GitHub returned at
          // connect time, then the GitHub login.
          name: r.fullName || metadata?.name || githubLogin,
          email: r.email,
          githubLogin,
        }
      })
      .filter((r): r is PtsStaffGitHubAccount => r.githubLogin.length > 0)
  }
)
