import 'server-only'

import { cache } from 'react'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { githubAppInstallations, githubRepoLinks } from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { fetchProjectDetail } from '@/lib/data/project-detail'
import { ensureInstallationVerified } from '@/lib/github/verify-installation'

export type ProjectGitHubLink = {
  id: string
  repoFullName: string
  defaultBranch: string
  /**
   * Linked through the client's own GitHub App installation, i.e. the client
   * owns the repo. Only those repos need staff added as collaborators; repos
   * in the agency's org are linked some other way and staff already have them.
   */
  viaClientInstallation: boolean
}

export type ProjectGitHubStatus = {
  /** The project's client has an active GitHub App installation. */
  hasInstallation: boolean
  /** Every repo linked to this project, however it was linked. */
  links: ProjectGitHubLink[]
}

/**
 * GitHub state for one project page, resolved on the server.
 *
 * A repo link is what matters, not the App install: repos in the agency's own
 * org are linked by staff without the client ever installing anything. The
 * install only matters when a project has no repo yet, since that is the one
 * case where the client may need to grant access to a repo they own.
 *
 * SECURITY: gated on fetchProjectDetail, which returns null for any project
 * outside the caller's portal scope; that call is cache()-wrapped so the page
 * pays for it once.
 */
export const fetchProjectGitHubStatus = cache(
  async (user: AppUser, projectId: string): Promise<ProjectGitHubStatus> => {
    const project = await fetchProjectDetail(user, projectId)
    if (!project?.clientId) return { hasInstallation: false, links: [] }

    const [installation, linkRows] = await Promise.all([
      fetchActiveInstallation(project.clientId),
      db
        .select({
          id: githubRepoLinks.id,
          repoFullName: githubRepoLinks.repoFullName,
          defaultBranch: githubRepoLinks.defaultBranch,
          githubAppInstallationId: githubRepoLinks.githubAppInstallationId,
        })
        .from(githubRepoLinks)
        .where(
          and(
            eq(githubRepoLinks.projectId, projectId),
            isNull(githubRepoLinks.deletedAt)
          )
        ),
    ])

    // Once-a-day liveness check against GitHub, so a missed `deleted` webhook
    // still gets noticed. Throttled, so it is a no-op on all but the first
    // view each day.
    const installationLive =
      installation !== null &&
      !(await ensureInstallationVerified(installation)).removed

    return {
      hasInstallation: installationLive,
      links: linkRows.map(row => ({
        id: row.id,
        repoFullName: row.repoFullName,
        defaultBranch: row.defaultBranch,
        viaClientInstallation:
          installationLive && row.githubAppInstallationId === installation.id,
      })),
    }
  }
)

async function fetchActiveInstallation(clientId: string) {
  const [installation] = await db
    .select({
      id: githubAppInstallations.id,
      installationId: githubAppInstallations.installationId,
      lastVerifiedAt: githubAppInstallations.lastVerifiedAt,
    })
    .from(githubAppInstallations)
    .where(
      and(
        eq(githubAppInstallations.clientId, clientId),
        eq(githubAppInstallations.status, 'ACTIVE'),
        isNull(githubAppInstallations.deletedAt)
      )
    )
    .limit(1)

  return installation ?? null
}
