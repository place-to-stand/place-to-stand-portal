import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { githubAppInstallations } from '@pts/db/schema'
import { getEnv } from '@/lib/env.server'
import { getInstallationById, isInstallationNotFoundError } from '@pts/github/app-auth'

const VERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000 // 1 day

/**
 * Confirms a `github_app_installations` row still exists on GitHub — but only
 * if it's been at least a day since the last check. GitHub's `deleted`
 * webhook can't reach local dev, and even in production a missed delivery has
 * no fallback, so this rides the existing page-load path instead of a
 * separate cron.
 *
 * Skips the GitHub call (and returns `{ removed: false }`) when verified
 * recently. Otherwise calls `getInstallationById`: on success, stamps
 * `lastVerifiedAt`; when GitHub confirms the installation is gone, marks the
 * row `REMOVED` (same shape as the `deleted` webhook handler) and returns
 * `{ removed: true }` so the caller can skip further GitHub calls for it. Any
 * other error (network blip, GitHub 5xx) is left alone rather than treated as
 * removal.
 */
export async function ensureInstallationVerified(installation: {
  id: string
  installationId: number
  lastVerifiedAt: string | null
}): Promise<{ removed: boolean }> {
  const dueForCheck =
    !installation.lastVerifiedAt ||
    Date.now() - new Date(installation.lastVerifiedAt).getTime() > VERIFY_INTERVAL_MS

  if (!dueForCheck) {
    return { removed: false }
  }

  const env = getEnv()

  try {
    await getInstallationById(
      installation.installationId,
      env.GITHUB_APP_ID,
      env.GITHUB_APP_PRIVATE_KEY
    )

    await db
      .update(githubAppInstallations)
      .set({ lastVerifiedAt: new Date().toISOString() })
      .where(eq(githubAppInstallations.id, installation.id))

    return { removed: false }
  } catch (error) {
    if (!isInstallationNotFoundError(error)) {
      return { removed: false }
    }

    await db
      .update(githubAppInstallations)
      .set({
        status: 'REMOVED',
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(githubAppInstallations.id, installation.id))

    return { removed: true }
  }
}
