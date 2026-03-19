import 'server-only'

import { cache } from 'react'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  projects,
  githubRepoLinks,
  githubAppInstallations,
} from '@pts/db/schema'

export type ProjectDetail = {
  id: string
  name: string
  status: string
  slug: string | null
  clientId: string | null
  github:
    | { state: 'no_installation' }
    | {
        state: 'installed'
        installationAccountLogin: string
        installationAccountAvatarUrl: string | null
      }
    | {
        state: 'linked'
        repoFullName: string
        repoOwner: string
        repoName: string
        defaultBranch: string
      }
}

export const fetchProjectDetail = cache(
  async (projectId: string): Promise<ProjectDetail | null> => {
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        slug: projects.slug,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1)

    if (!project) return null

    // Fetch repo link and installation in parallel
    const [repoLink, installation] = await Promise.all([
      db
        .select({
          repoFullName: githubRepoLinks.repoFullName,
          repoOwner: githubRepoLinks.repoOwner,
          repoName: githubRepoLinks.repoName,
          defaultBranch: githubRepoLinks.defaultBranch,
        })
        .from(githubRepoLinks)
        .where(
          and(
            eq(githubRepoLinks.projectId, projectId),
            eq(githubRepoLinks.isActive, true),
            isNull(githubRepoLinks.deletedAt)
          )
        )
        .limit(1)
        .then(rows => rows[0] ?? null),
      project.clientId
        ? db
            .select({
              accountLogin: githubAppInstallations.accountLogin,
              accountAvatarUrl: githubAppInstallations.accountAvatarUrl,
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
            .then(rows => rows[0] ?? null)
        : null,
    ])

    let github: ProjectDetail['github']
    if (repoLink) {
      github = {
        state: 'linked',
        repoFullName: repoLink.repoFullName,
        repoOwner: repoLink.repoOwner,
        repoName: repoLink.repoName,
        defaultBranch: repoLink.defaultBranch,
      }
    } else if (installation) {
      github = {
        state: 'installed',
        installationAccountLogin: installation.accountLogin,
        installationAccountAvatarUrl: installation.accountAvatarUrl,
      }
    } else {
      github = { state: 'no_installation' }
    }

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      slug: project.slug,
      clientId: project.clientId,
      github,
    }
  }
)
