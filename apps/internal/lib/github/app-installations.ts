import 'server-only'

import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { githubAppInstallations, projects } from '@/lib/db/schema'

export interface ActiveAppInstallation {
  id: string
  installationId: number
  accountLogin: string
  accountAvatarUrl: string | null
  repositorySelection: string
}

/**
 * Find the active GitHub App installation for a project's client, if any.
 *
 * Distinct from a staff member's own OAuth connection: this is the repo
 * access a client granted us by installing the GitHub App on their org/repos.
 */
export async function getActiveInstallationForProject(
  projectId: string
): Promise<ActiveAppInstallation | null> {
  const [project] = await db
    .select({ clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!project?.clientId) return null

  const [installation] = await db
    .select({
      id: githubAppInstallations.id,
      installationId: githubAppInstallations.installationId,
      accountLogin: githubAppInstallations.accountLogin,
      accountAvatarUrl: githubAppInstallations.accountAvatarUrl,
      repositorySelection: githubAppInstallations.repositorySelection,
    })
    .from(githubAppInstallations)
    .where(
      and(
        eq(githubAppInstallations.clientId, project.clientId),
        eq(githubAppInstallations.status, 'ACTIVE'),
        isNull(githubAppInstallations.deletedAt)
      )
    )
    .limit(1)

  return installation ?? null
}
