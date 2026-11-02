import 'server-only'

import { getInstallationRepo } from '@pts/github'
import { isInstallationNotFoundError } from '@pts/github/app-auth'

import type { RepoLinkInput } from '@/lib/data/github-repos'
import { serverEnv } from '@/lib/env.server'
import { getDefaultConnectionId, getRepo } from '@/lib/github/client'
import type { ActiveAppInstallation } from '@/lib/github/app-installations'

/** A repo the sheet or the REST route wants to link, as the picker sent it. */
export type RepoLinkRequest = {
  repoFullName: string
  /** The staff member's own GitHub OAuth connection (default when neither is set). */
  connectionId?: string
  /** The project client's GitHub App installation (our row id). */
  githubAppInstallationId?: string
}

export type RepoLinkResolution =
  | { ok: true; repo: RepoLinkInput }
  | { ok: false; error: string; status: number; code?: 'NOT_CONNECTED' }

/**
 * Looks a repo up on GitHub with the access it was picked through, so a link
 * is only written for a repo the caller can actually see. Talks to GitHub but
 * writes nothing: callers resolve every repo first, then write in one
 * transaction.
 *
 * `loadInstallation` returns the client's active GitHub App installation
 * (by project for an existing project, by company for one being created).
 */
export async function resolveRepoForLink(
  userId: string,
  request: RepoLinkRequest,
  loadInstallation: () => Promise<ActiveAppInstallation | null>
): Promise<RepoLinkResolution> {
  const [owner, name] = request.repoFullName.split('/')

  if (request.githubAppInstallationId) {
    const installation = await loadInstallation()

    if (!installation || installation.id !== request.githubAppInstallationId) {
      return {
        ok: false,
        error: 'GitHub App installation not found for this project',
        status: 400,
      }
    }

    if (!serverEnv.GITHUB_APP_ID || !serverEnv.GITHUB_APP_PRIVATE_KEY) {
      return {
        ok: false,
        error: 'GitHub App credentials are not configured',
        status: 500,
      }
    }

    try {
      const details = await getInstallationRepo(
        installation.installationId,
        serverEnv.GITHUB_APP_ID,
        serverEnv.GITHUB_APP_PRIVATE_KEY,
        owner,
        name
      )
      return {
        ok: true,
        repo: {
          githubAppInstallationId: installation.id,
          repoOwner: details.owner.login,
          repoName: details.name,
          repoFullName: details.full_name,
          repoId: details.id,
          defaultBranch: details.default_branch,
        },
      }
    } catch (error) {
      if (isInstallationNotFoundError(error)) {
        return {
          ok: false,
          error:
            'GitHub App installation was removed. Ask the client to reinstall it.',
          status: 400,
        }
      }
      console.error('Error looking up repo via GitHub App installation:', error)
      return { ok: false, error: 'Failed to link repository', status: 500 }
    }
  }

  const notConnected = {
    ok: false as const,
    error: 'No GitHub account connected',
    status: 401,
    code: 'NOT_CONNECTED' as const,
  }

  try {
    const connectionId =
      request.connectionId ?? (await getDefaultConnectionId(userId))
    if (!connectionId) return notConnected

    const details = await getRepo(userId, owner, name, connectionId)
    return {
      ok: true,
      repo: {
        oauthConnectionId: connectionId,
        repoOwner: details.owner.login,
        repoName: details.name,
        repoFullName: details.full_name,
        repoId: details.id,
        defaultBranch: details.default_branch,
      },
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('No active GitHub')) return notConnected
      if (error.message.includes('GitHub API error (404)')) {
        return {
          ok: false,
          error: 'Repository not found or no access',
          status: 404,
        }
      }
    }
    console.error('Error looking up repo:', error)
    return { ok: false, error: 'Failed to link repository', status: 500 }
  }
}
