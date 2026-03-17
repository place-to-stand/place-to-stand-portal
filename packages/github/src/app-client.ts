import { getInstallationToken } from './app-auth'
import type { GitHubRepo } from './types'

const GITHUB_API_BASE = 'https://api.github.com'

/**
 * Make an authenticated GitHub API request using an installation token.
 */
async function installationFetch<T>(
  installationId: number,
  appId: string,
  privateKeyBase64: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { token } = await getInstallationToken(
    installationId,
    appId,
    privateKeyBase64
  )

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub API error (${response.status}): ${error}`)
  }

  return response.json()
}

/**
 * List repositories accessible to an installation.
 */
export async function listInstallationRepos(
  installationId: number,
  appId: string,
  privateKeyBase64: string
): Promise<GitHubRepo[]> {
  const data = await installationFetch<{
    repositories: GitHubRepo[]
    total_count: number
  }>(
    installationId,
    appId,
    privateKeyBase64,
    '/installation/repositories?per_page=100'
  )

  return data.repositories
}

/**
 * Get a single repository via installation token.
 */
export async function getInstallationRepo(
  installationId: number,
  appId: string,
  privateKeyBase64: string,
  owner: string,
  repo: string
): Promise<GitHubRepo> {
  return installationFetch<GitHubRepo>(
    installationId,
    appId,
    privateKeyBase64,
    `/repos/${owner}/${repo}`
  )
}
