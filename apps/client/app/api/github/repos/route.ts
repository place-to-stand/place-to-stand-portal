import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { githubAppInstallations } from '@pts/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { ensureClientAccess } from '@/lib/auth/permissions'
import { getEnv } from '@/lib/env.server'
import { listInstallationRepos } from '@pts/github/app-client'
import { isInstallationNotFoundError } from '@pts/github/app-auth'
import { ensureInstallationVerified } from '@/lib/github/verify-installation'

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

  // Throttled to once a day — skips the GitHub call entirely if we checked
  // recently, so this doesn't hit GitHub on every project-page load.
  const { removed } = await ensureInstallationVerified(installation)
  if (removed) {
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
    // The installation was uninstalled on GitHub's side (or the `deleted`
    // webhook never reached this environment) — self-heal the stale row so
    // the client sees "not installed" instead of a raw error.
    if (isInstallationNotFoundError(error)) {
      await db
        .update(githubAppInstallations)
        .set({
          status: 'REMOVED',
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(githubAppInstallations.id, installation.id))

      return NextResponse.json({
        ok: true,
        data: { repos: [], hasInstallation: false },
      })
    }

    console.error('Failed to list installation repos:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to list repositories' },
      { status: 500 }
    )
  }
}
