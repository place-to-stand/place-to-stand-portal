import 'server-only'

import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  githubAppInstallations,
  oauthConnections,
} from '@/lib/db/schema'
import { decryptToken } from '@/lib/oauth/encryption'
import { getInstallationToken } from '@pts/github'
import { serverEnv } from '@/lib/env.server'

/**
 * Resolve a repo link to a bearer token, regardless of auth method.
 *
 * - OAuth-linked repos: decrypts the stored OAuth access token
 * - GitHub App-linked repos: generates a short-lived installation token
 *
 * Throws if the repo link has no usable auth credentials.
 */
export async function resolveRepoLinkAuth(
  userId: string,
  repoLink: {
    oauthConnectionId: string | null
    githubAppInstallationId: string | null
  }
): Promise<{ token: string }> {
  // --- OAuth path ---
  if (repoLink.oauthConnectionId) {
    const [conn] = await db
      .select({
        accessToken: oauthConnections.accessToken,
        status: oauthConnections.status,
      })
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.userId, userId),
          eq(oauthConnections.provider, 'GITHUB'),
          eq(oauthConnections.status, 'ACTIVE'),
          isNull(oauthConnections.deletedAt)
        )
      )
      .limit(1)

    if (!conn) {
      throw new Error(
        'You need to connect your GitHub account to perform this action.'
      )
    }

    return { token: decryptToken(conn.accessToken) }
  }

  // --- GitHub App installation path ---
  if (repoLink.githubAppInstallationId) {
    const appId = serverEnv.GITHUB_APP_ID
    const privateKey = serverEnv.GITHUB_APP_PRIVATE_KEY

    if (!appId || !privateKey) {
      throw new Error(
        'GitHub App credentials (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY) are not configured.'
      )
    }

    const [installation] = await db
      .select({ installationId: githubAppInstallations.installationId })
      .from(githubAppInstallations)
      .where(
        and(
          eq(githubAppInstallations.id, repoLink.githubAppInstallationId),
          eq(githubAppInstallations.status, 'ACTIVE'),
          isNull(githubAppInstallations.deletedAt)
        )
      )
      .limit(1)

    if (!installation) {
      throw new Error(
        'GitHub App installation is inactive or removed. Reinstall the GitHub App to continue.'
      )
    }

    const { token } = await getInstallationToken(
      installation.installationId,
      appId,
      privateKey
    )

    return { token }
  }

  throw new Error(
    'Repository link has no OAuth connection or GitHub App installation configured.'
  )
}
