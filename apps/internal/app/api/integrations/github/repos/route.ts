import { NextRequest, NextResponse } from 'next/server'
import { listInstallationRepos, type GitHubRepo } from '@pts/github'
import { requireRole } from '@/lib/auth/session'
import { listUserRepos, getDefaultConnectionId } from '@/lib/github/client'
import { getActiveInstallationForProject } from '@/lib/github/app-installations'
import { serverEnv } from '@/lib/env.server'

interface RepoListItem {
  id: number
  name: string
  fullName: string
  owner: string
  ownerAvatar: string
  defaultBranch: string
  private: boolean
  description: string | null
  url: string
  source: 'oauth' | 'app'
  /** connectionId for 'oauth' repos, github_app_installations.id for 'app' repos */
  sourceId: string
}

function toRepoListItem(
  r: GitHubRepo,
  source: RepoListItem['source'],
  sourceId: string
): RepoListItem {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: r.owner.login,
    ownerAvatar: r.owner.avatar_url,
    defaultBranch: r.default_branch,
    private: r.private,
    description: r.description,
    url: r.html_url,
    source,
    sourceId,
  }
}

export async function GET(request: NextRequest) {
  const user = await requireRole('ADMIN')
  const { searchParams } = new URL(request.url)
  const connectionId = searchParams.get('connectionId') ?? undefined
  const projectId = searchParams.get('projectId') ?? undefined

  const repos: RepoListItem[] = []

  // Repos the staff member has access to via their own connected GitHub account.
  let effectiveConnectionId: string | null = null
  try {
    effectiveConnectionId = connectionId ?? await getDefaultConnectionId(user.id)
    if (effectiveConnectionId) {
      const oauthRepos = await listUserRepos(user.id, { connectionId: effectiveConnectionId })
      repos.push(...oauthRepos.map(r => toRepoListItem(r, 'oauth', effectiveConnectionId!)))
    }
  } catch (error) {
    console.error('Error fetching OAuth GitHub repos:', error)
  }

  // Repos the project's client granted access to via their GitHub App installation.
  let hasAppInstallation = false
  if (projectId) {
    const installation = await getActiveInstallationForProject(projectId)
    if (installation) {
      hasAppInstallation = true
      if (serverEnv.GITHUB_APP_ID && serverEnv.GITHUB_APP_PRIVATE_KEY) {
        try {
          const appRepos = await listInstallationRepos(
            installation.installationId,
            serverEnv.GITHUB_APP_ID,
            serverEnv.GITHUB_APP_PRIVATE_KEY
          )
          repos.push(...appRepos.map(r => toRepoListItem(r, 'app', installation.id)))
        } catch (error) {
          console.error('Error fetching GitHub App installation repos:', error)
        }
      } else {
        console.error('GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY not configured on internal app')
      }
    }
  }

  if (!effectiveConnectionId && !hasAppInstallation) {
    return NextResponse.json(
      { error: 'GitHub not connected', code: 'NOT_CONNECTED' },
      { status: 401 }
    )
  }

  return NextResponse.json({ repos, connectionId: effectiveConnectionId })
}
