import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { githubAppInstallations, clientMembers } from '@pts/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { ensureClientAccess, isAdmin } from '@/lib/auth/permissions'
import { getEnv } from '@/lib/env.server'
import { listInstallationRepos } from '@pts/github/app-client'

/**
 * GET /api/github/repos?clientId=xxx
 *
 * Lists repositories accessible to a client's GitHub App installation.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const clientId = url.searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: 'clientId is required' },
      { status: 400 }
    )
  }

  await ensureClientAccess(user, clientId)

  const env = getEnv()

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
    return NextResponse.json({
      ok: true,
      data: { repos: [], hasInstallation: false },
    })
  }

  try {
    const repos = await listInstallationRepos(
      installation.installationId,
      env.GITHUB_APP_ID,
      env.GITHUB_APP_PRIVATE_KEY
    )

    return NextResponse.json({
      ok: true,
      data: {
        repos: repos.map(r => ({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          owner: r.owner.login,
          defaultBranch: r.default_branch,
          private: r.private,
          description: r.description,
          htmlUrl: r.html_url,
        })),
        hasInstallation: true,
        installation: {
          accountLogin: installation.accountLogin,
          accountAvatarUrl: installation.accountAvatarUrl,
        },
      },
    })
  } catch (error) {
    console.error('Failed to list installation repos:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to list repositories' },
      { status: 500 }
    )
  }
}
