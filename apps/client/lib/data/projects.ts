import 'server-only'

import { cache } from 'react'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  projects,
  clientMembers,
  githubRepoLinks,
  githubAppInstallations,
} from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'

export type ClientProject = {
  id: string
  name: string
  status: string
  slug: string | null
  clientId: string | null
  hasRepoLinked: boolean
  repoFullName: string | null
  hasInstallation: boolean
}

export const fetchClientProjects = cache(
  async (user: AppUser): Promise<ClientProject[]> => {
    // Get client IDs the user has access to
    const memberships = isAdmin(user)
      ? []
      : await db
          .select({ clientId: clientMembers.clientId })
          .from(clientMembers)
          .where(
            and(
              eq(clientMembers.userId, user.id),
              isNull(clientMembers.deletedAt)
            )
          )

    const clientIds = memberships.map(m => m.clientId)
    if (clientIds.length === 0) return []

    // Fetch projects, repo links, and installations in parallel
    const [projectRows, repoLinks, installations] = await Promise.all([
      db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          slug: projects.slug,
          clientId: projects.clientId,
        })
        .from(projects)
        .where(
          and(
            inArray(projects.clientId, clientIds),
            isNull(projects.deletedAt)
          )
        ),
      db
        .select({
          projectId: githubRepoLinks.projectId,
          repoFullName: githubRepoLinks.repoFullName,
        })
        .from(githubRepoLinks)
        .where(
          and(
            eq(githubRepoLinks.isActive, true),
            isNull(githubRepoLinks.deletedAt)
          )
        ),
      db
        .select({
          clientId: githubAppInstallations.clientId,
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

    const repoLinkMap = new Map(
      repoLinks.map(r => [r.projectId, r.repoFullName])
    )
    const clientsWithInstallation = new Set(
      installations.map(i => i.clientId)
    )

    return projectRows.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      slug: p.slug,
      clientId: p.clientId,
      hasRepoLinked: repoLinkMap.has(p.id),
      repoFullName: repoLinkMap.get(p.id) ?? null,
      hasInstallation: p.clientId
        ? clientsWithInstallation.has(p.clientId)
        : false,
    }))
  }
)
