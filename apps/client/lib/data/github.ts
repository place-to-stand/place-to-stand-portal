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
