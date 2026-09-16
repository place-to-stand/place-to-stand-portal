import 'server-only'

import { cache } from 'react'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clients,
  githubAppInstallations,
  githubRepoLinks,
  projects,
} from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { resolvePortalScope } from '@/lib/auth/view-as'
import { fetchProjectDetail } from '@/lib/data/project-detail'
import { ensureInstallationVerified } from '@/lib/github/verify-installation'

export type ClientGitHubStatus =
  | {
      kind: 'not_connected'
      clientId: string
      clientName: string
    }
  | {
      kind: 'connected'
      clientId: string
      clientName: string
      accountLogin: string
      linkedRepos: {
        id: string
        repoFullName: string
        projectId: string
        projectName: string
      }[]
    }

/**
 * GitHub App connection status per client in scope, for the dashboard's
 * "connect / here's what's linked" prompt.
 *
 * SECURITY: client ids come only from resolvePortalScope — never from a route
 * param, query string, or request body — so there is no IDOR surface here.
 */
export const fetchClientGitHubStatus = cache(
  async (user: AppUser): Promise<ClientGitHubStatus[]> => {
    const { clientIds } = await resolvePortalScope(user)
    if (clientIds.length === 0) return []

    const [clientRows, installationRows] = await Promise.all([
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(and(inArray(clients.id, clientIds), isNull(clients.deletedAt))),
      db
        .select({
          id: githubAppInstallations.id,
          clientId: githubAppInstallations.clientId,
          accountLogin: githubAppInstallations.accountLogin,
        })
        .from(githubAppInstallations)
        .where(
          and(
            inArray(githubAppInstallations.clientId, clientIds),
            eq(githubAppInstallations.status, 'ACTIVE'),
            isNull(githubAppInstallations.deletedAt)
          )
        ),
    ])

    const installationByClient = new Map(
      installationRows.map(i => [i.clientId, i])
    )
    const installationIds = installationRows.map(i => i.id)

    const linkRows = installationIds.length
      ? await db
          .select({
            id: githubRepoLinks.id,
            repoFullName: githubRepoLinks.repoFullName,
            githubAppInstallationId: githubRepoLinks.githubAppInstallationId,
            projectId: projects.id,
            projectName: projects.name,
          })
          .from(githubRepoLinks)
          .innerJoin(projects, eq(projects.id, githubRepoLinks.projectId))
          .where(
            and(
              inArray(githubRepoLinks.githubAppInstallationId, installationIds),
              isNull(githubRepoLinks.deletedAt)
            )
          )
      : []

    const linksByInstallation = new Map<string, typeof linkRows>()
    for (const row of linkRows) {
      // Non-null: filtered to rows whose installation id is in installationIds.
      const installationId = row.githubAppInstallationId as string
      const existing = linksByInstallation.get(installationId) ?? []
      existing.push(row)
      linksByInstallation.set(installationId, existing)
    }

    return clientRows.map((client): ClientGitHubStatus => {
      const installation = installationByClient.get(client.id)

      if (!installation) {
        return { kind: 'not_connected', clientId: client.id, clientName: client.name }
      }

      return {
        kind: 'connected',
        clientId: client.id,
        clientName: client.name,
        accountLogin: installation.accountLogin,
        linkedRepos: (linksByInstallation.get(installation.id) ?? []).map(r => ({
          id: r.id,
          repoFullName: r.repoFullName,
          projectId: r.projectId,
          projectName: r.projectName,
        })),
      }
    })
  }
)

export type ProjectGitHubLink = {
  id: string
  repoFullName: string
  defaultBranch: string
}

export type ProjectGitHubStatus = {
  /** The project's client has an active GitHub App installation. */
  hasInstallation: boolean
  /** Repos linked to this project through that installation. */
  links: ProjectGitHubLink[]
}

const NO_GITHUB: ProjectGitHubStatus = { hasInstallation: false, links: [] }

/**
 * GitHub state for one project page, resolved on the server.
 *
 * Replaces the pair of client-side fetches the section used to make on mount
 * (`/api/github/repos` then `/api/github/link`). The first of those listed
 * every repository through GitHub's API on every page view just to read
 * `hasInstallation` — this answers the same question from the database alone.
 *
 * SECURITY: gated on fetchProjectDetail, which returns null for any project
 * outside the caller's portal scope; that call is cache()-wrapped so the page
 * pays for it once.
 */
export const fetchProjectGitHubStatus = cache(
  async (user: AppUser, projectId: string): Promise<ProjectGitHubStatus> => {
    const project = await fetchProjectDetail(user, projectId)
    if (!project?.clientId) return NO_GITHUB

    const [installation] = await db
      .select({
        id: githubAppInstallations.id,
        installationId: githubAppInstallations.installationId,
        lastVerifiedAt: githubAppInstallations.lastVerifiedAt,
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

    if (!installation) return NO_GITHUB

    // Once-a-day liveness check against GitHub. It used to ride the repos API
    // route this page called on mount; it rides the page render now so a
    // missed `deleted` webhook still gets noticed. Throttled, so it is a no-op
    // on all but the first view each day.
    const { removed } = await ensureInstallationVerified(installation)
    if (removed) return NO_GITHUB

    const links = await db
      .select({
        id: githubRepoLinks.id,
        repoFullName: githubRepoLinks.repoFullName,
        defaultBranch: githubRepoLinks.defaultBranch,
      })
      .from(githubRepoLinks)
      .where(
        and(
          eq(githubRepoLinks.projectId, projectId),
          isNull(githubRepoLinks.deletedAt)
        )
      )

    return { hasInstallation: true, links }
  }
)
