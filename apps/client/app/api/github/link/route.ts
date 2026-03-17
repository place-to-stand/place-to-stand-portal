import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import {
  githubAppInstallations,
  githubRepoLinks,
  projects,
} from '@pts/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { ensureClientAccess } from '@/lib/auth/permissions'
import { getEnv } from '@/lib/env.server'
import { getInstallationRepo } from '@pts/github/app-client'

const linkSchema = z.object({
  projectId: z.string().uuid(),
  clientId: z.string().uuid(),
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
})

/**
 * POST /api/github/link
 *
 * Links a GitHub repository to a PTS project via GitHub App installation.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const result = linkSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }

  const { projectId, clientId, repoOwner, repoName } = result.data

  await ensureClientAccess(user, clientId)

  // Verify project belongs to this client
  const [project] = await db
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(
      and(eq(projects.id, projectId), isNull(projects.deletedAt))
    )
    .limit(1)

  if (!project || project.clientId !== clientId) {
    return NextResponse.json(
      { ok: false, error: 'Project not found or not accessible' },
      { status: 404 }
    )
  }

  // Find active installation for this client
  const [installation] = await db
    .select()
    .from(githubAppInstallations)
    .where(
      and(
        eq(githubAppInstallations.clientId, clientId),
        eq(githubAppInstallations.status, 'ACTIVE'),
        isNull(githubAppInstallations.deletedAt)
      )
    )
    .limit(1)

  if (!installation) {
    return NextResponse.json(
      { ok: false, error: 'No GitHub App installation found for this client' },
      { status: 400 }
    )
  }

  const env = getEnv()

  try {
    // Verify repo is accessible via installation
    const repo = await getInstallationRepo(
      installation.installationId,
      env.GITHUB_APP_ID,
      env.GITHUB_APP_PRIVATE_KEY,
      repoOwner,
      repoName
    )

    // Create the repo link
    const [link] = await db
      .insert(githubRepoLinks)
      .values({
        projectId,
        githubAppInstallationId: installation.id,
        repoOwner: repo.owner.login,
        repoName: repo.name,
        repoFullName: repo.full_name,
        repoId: repo.id,
        defaultBranch: repo.default_branch,
        linkedBy: user.id,
      })
      .returning()

    return NextResponse.json({ ok: true, data: link })
  } catch (error) {
    console.error('Failed to link repo:', error)

    const message =
      error instanceof Error && error.message.includes('404')
        ? 'Repository not found or not accessible by the GitHub App'
        : 'Failed to link repository'

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
