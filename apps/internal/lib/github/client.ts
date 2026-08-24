import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { decryptToken } from '@/lib/oauth/encryption'

export { resolveRepoLinkAuth } from './resolve-auth'

/**
 * Union type for GitHub authentication.
 *
 * - `string`           — OAuth connection ID (legacy callers)
 * - `{ token: string }` — Pre-resolved bearer token (from resolveRepoLinkAuth)
 * - `undefined`         — Use default OAuth connection for the user
 */
export type GitHubAuth = string | { token: string } | undefined

const GITHUB_API_BASE = 'https://api.github.com'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string; avatar_url: string }
  default_branch: string
  private: boolean
  description: string | null
  html_url: string
  permissions?: {
    admin: boolean
    push: boolean
    pull: boolean
  }
}

interface GitHubBranch {
  name: string
  commit: {
    sha: string
    url: string
  }
  protected: boolean
}

/**
 * Get GitHub access token for a specific connection
 */
async function getGitHubToken(
  userId: string,
  connectionId?: string
): Promise<{ token: string; connectionId: string }> {
  const conditions = [
    eq(oauthConnections.userId, userId),
    eq(oauthConnections.provider, 'GITHUB'),
    eq(oauthConnections.status, 'ACTIVE'),
    isNull(oauthConnections.deletedAt),
  ]

  // If specific connection requested, add that filter
  if (connectionId) {
    conditions.push(eq(oauthConnections.id, connectionId))
  }

  const [connection] = await db
    .select()
    .from(oauthConnections)
    .where(and(...conditions))
    .limit(1)

  if (!connection) {
    throw new Error('No active GitHub connection')
  }

  return {
    token: decryptToken(connection.accessToken),
    connectionId: connection.id,
  }
}

/**
 * Make authenticated GitHub API request
 */
async function githubFetch<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {},
  auth?: GitHubAuth
): Promise<T> {
  const token =
    typeof auth === 'object' && auth !== null
      ? auth.token
      : (await getGitHubToken(userId, auth)).token

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
 * List repositories user has access to
 */
export async function listUserRepos(
  userId: string,
  options: { page?: number; perPage?: number; connectionId?: string } = {}
): Promise<GitHubRepo[]> {
  const { page = 1, perPage = 100, connectionId } = options

  return githubFetch(
    userId,
    `/user/repos?sort=updated&per_page=${perPage}&page=${page}`,
    {},
    connectionId
  )
}

/**
 * Get single repository details
 */
export async function getRepo(
  userId: string,
  owner: string,
  repo: string,
  auth?: GitHubAuth
): Promise<GitHubRepo> {
  return githubFetch(userId, `/repos/${owner}/${repo}`, {}, auth)
}

/**
 * Create a pull request
 */
export async function createPullRequest(
  userId: string,
  owner: string,
  repo: string,
  params: {
    title: string
    body: string
    head: string
    base: string
    draft?: boolean
  },
  auth?: GitHubAuth
): Promise<{ number: number; html_url: string }> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/pulls`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    auth
  )
}

/**
 * Get repository branches
 */
export async function listBranches(
  userId: string,
  owner: string,
  repo: string,
  auth?: GitHubAuth
): Promise<GitHubBranch[]> {
  return githubFetch(userId, `/repos/${owner}/${repo}/branches`, {}, auth)
}

/**
 * Get a specific branch (to get its SHA)
 */
export async function getBranch(
  userId: string,
  owner: string,
  repo: string,
  branch: string,
  auth?: GitHubAuth
): Promise<GitHubBranch> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
    {},
    auth
  )
}

/**
 * Create a new branch from a base branch
 */
export async function createBranch(
  userId: string,
  owner: string,
  repo: string,
  params: {
    newBranch: string
    baseBranch: string
  },
  auth?: GitHubAuth
): Promise<{ ref: string; sha: string }> {
  // First, get the SHA of the base branch
  const baseBranchInfo = await getBranch(userId, owner, repo, params.baseBranch, auth)
  const sha = baseBranchInfo.commit.sha

  // Create the new branch reference
  const result = await githubFetch<{ ref: string; object: { sha: string } }>(
    userId,
    `/repos/${owner}/${repo}/git/refs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${params.newBranch}`,
        sha,
      }),
    },
    auth
  )

  return { ref: result.ref, sha: result.object.sha }
}

/**
 * Check if a branch exists
 * Returns false only for 404 (not found), rethrows other errors (auth, rate limit, network)
 */
export async function branchExists(
  userId: string,
  owner: string,
  repo: string,
  branch: string,
  auth?: GitHubAuth
): Promise<boolean> {
  try {
    await getBranch(userId, owner, repo, branch, auth)
    return true
  } catch (error) {
    // Only treat 404 as "branch doesn't exist"
    // Rethrow auth errors, rate limits, network errors, etc.
    if (error instanceof Error && error.message.includes('(404)')) {
      return false
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Issue & Comment helpers (for pts-worker integration)
// ---------------------------------------------------------------------------

interface GitHubIssue {
  number: number
  html_url: string
}

interface GitHubCommentResult {
  id: number
  html_url: string
}

export interface GitHubComment {
  id: number
  body: string
  user: { login: string; avatar_url: string }
  created_at: string
  html_url: string
}

/**
 * Create a GitHub issue
 */
export async function createIssue(
  userId: string,
  owner: string,
  repo: string,
  params: { title: string; body: string; labels?: string[] },
  auth?: GitHubAuth
): Promise<GitHubIssue> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    auth
  )
}

/**
 * Create a comment on a GitHub issue
 */
export async function createIssueComment(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  auth?: GitHubAuth
): Promise<GitHubCommentResult> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    },
    auth
  )
}

/**
 * List comments on a GitHub issue
 */
export async function listIssueComments(
  userId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  auth?: GitHubAuth
): Promise<GitHubComment[]> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
    {},
    auth
  )
}

/**
 * Add a reaction to an issue comment
 */
export async function createCommentReaction(
  userId: string,
  owner: string,
  repo: string,
  commentId: number,
  content: string,
  auth?: GitHubAuth
): Promise<{ id: number }> {
  return githubFetch(
    userId,
    `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
    auth
  )
}

// ---------------------------------------------------------------------------
// File / Tree / Search helpers (for AI planning tool use)
// ---------------------------------------------------------------------------

interface GitHubFileContent {
  type: 'file'
  name: string
  path: string
  content: string // base64
  encoding: string
  size: number
  sha: string
}

interface GitHubDirEntry {
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  name: string
  path: string
  size: number
  sha: string
}

interface GitHubTreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
}

interface GitHubTreeResponse {
  sha: string
  tree: GitHubTreeEntry[]
  truncated: boolean
}

interface GitHubSearchCodeResult {
  total_count: number
  items: Array<{
    name: string
    path: string
    sha: string
    html_url: string
    repository: { full_name: string }
    text_matches?: Array<{
      fragment: string
      matches: Array<{ text: string; indices: number[] }>
    }>
  }>
}

/**
 * Get file contents or directory listing from a GitHub repo.
 * For files: returns decoded UTF-8 content.
 * For directories: returns array of entries.
 */
export async function getFileContents(
  userId: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
  auth?: GitHubAuth
): Promise<
  | { type: 'file'; content: string; path: string; size: number; sha: string }
  | { type: 'dir'; entries: Array<{ type: string; name: string; path: string; size: number }> }
> {
  const params = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const result = await githubFetch<GitHubFileContent | GitHubDirEntry[]>(
    userId,
    `/repos/${owner}/${repo}/contents/${encodedPath}${params}`,
    {},
    auth
  )

  // Directory response is an array
  if (Array.isArray(result)) {
    return {
      type: 'dir',
      entries: result.map(e => ({
        type: e.type,
        name: e.name,
        path: e.path,
        size: e.size,
      })),
    }
  }

  // File response — decode base64 content
  const content = Buffer.from(result.content, 'base64').toString('utf-8')
  return {
    type: 'file',
    content,
    path: result.path,
    size: result.size,
    sha: result.sha,
  }
}

/**
 * Get the full repository tree (recursive).
 * Returns a flat list of paths with types.
 */
export async function getRepoTree(
  userId: string,
  owner: string,
  repo: string,
  ref = 'HEAD',
  auth?: GitHubAuth
): Promise<{ entries: Array<{ path: string; type: 'blob' | 'tree'; size?: number }>; truncated: boolean }> {
  const result = await githubFetch<GitHubTreeResponse>(
    userId,
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    {},
    auth
  )

  return {
    entries: result.tree.map(e => ({
      path: e.path,
      type: e.type,
      size: e.size,
    })),
    truncated: result.truncated,
  }
}

/**
 * Search code in a specific repository.
 * Uses the GitHub Code Search API with text-match fragments.
 */
export async function searchRepoCode(
  userId: string,
  owner: string,
  repo: string,
  query: string,
  auth?: GitHubAuth
): Promise<Array<{ name: string; path: string; fragments: string[] }>> {
  const q = encodeURIComponent(`${query} repo:${owner}/${repo}`)
  const result = await githubFetch<GitHubSearchCodeResult>(
    userId,
    `/search/code?q=${q}`,
    {
      headers: {
        Accept: 'application/vnd.github.text-match+json',
      },
    },
    auth
  )

  return result.items.map(item => ({
    name: item.name,
    path: item.path,
    fragments: item.text_matches?.map(m => m.fragment) ?? [],
  }))
}

// ---------------------------------------------------------------------------
// Pull requests & comparisons (read-only, for AI tool use)
// ---------------------------------------------------------------------------

export interface GitHubPullRequestListItem {
  number: number
  title: string
  state: 'open' | 'closed'
  draft: boolean
  html_url: string
  head: { ref: string; sha: string }
  base: { ref: string; sha: string }
  user: { login: string }
  created_at: string
  updated_at: string
  merged_at: string | null
}

export interface GitHubPullRequestDetail extends GitHubPullRequestListItem {
  body: string | null
  merged: boolean
  additions: number
  deletions: number
  changed_files: number
}

export interface GitHubDiffFile {
  filename: string
  status: string
  additions: number
  deletions: number
  changes: number
  patch?: string
}

export interface GitHubCompareResult {
  status: 'ahead' | 'behind' | 'identical' | 'diverged'
  ahead_by: number
  behind_by: number
  total_commits: number
  files: GitHubDiffFile[]
}

/**
 * List pull requests for a repo.
 */
export async function listPullRequests(
  userId: string,
  owner: string,
  repo: string,
  options: { state?: 'open' | 'closed' | 'all'; base?: string; perPage?: number } = {},
  auth?: GitHubAuth
): Promise<GitHubPullRequestListItem[]> {
  const { state = 'open', base, perPage = 30 } = options
  const params = new URLSearchParams({ state, per_page: String(perPage) })
  if (base) params.set('base', base)
  return githubFetch(userId, `/repos/${owner}/${repo}/pulls?${params.toString()}`, {}, auth)
}

/**
 * Get a single pull request's metadata (not the diff — see getPullRequestFiles).
 */
export async function getPullRequest(
  userId: string,
  owner: string,
  repo: string,
  number: number,
  auth?: GitHubAuth
): Promise<GitHubPullRequestDetail> {
  return githubFetch(userId, `/repos/${owner}/${repo}/pulls/${number}`, {}, auth)
}

/**
 * Get the changed files (with unified diff patches) for a pull request.
 */
export async function getPullRequestFiles(
  userId: string,
  owner: string,
  repo: string,
  number: number,
  auth?: GitHubAuth
): Promise<GitHubDiffFile[]> {
  return githubFetch(userId, `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`, {}, auth)
}

/**
 * Compare two refs (branches, tags, or SHAs) — e.g. a feature branch against
 * main. Read-only equivalent of `git diff base...head`.
 */
export async function compareCommits(
  userId: string,
  owner: string,
  repo: string,
  base: string,
  head: string,
  auth?: GitHubAuth
): Promise<GitHubCompareResult> {
  const result = await githubFetch<{
    status: 'ahead' | 'behind' | 'identical' | 'diverged'
    ahead_by: number
    behind_by: number
    total_commits: number
    files?: GitHubDiffFile[]
  }>(
    userId,
    `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    {},
    auth
  )
  return {
    status: result.status,
    ahead_by: result.ahead_by,
    behind_by: result.behind_by,
    total_commits: result.total_commits,
    files: result.files ?? [],
  }
}

/**
 * Get the default connection ID for a user
 */
export async function getDefaultConnectionId(userId: string): Promise<string | null> {
  const [connection] = await db
    .select({ id: oauthConnections.id })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, 'GITHUB'),
        eq(oauthConnections.status, 'ACTIVE'),
        isNull(oauthConnections.deletedAt)
      )
    )
    .limit(1)

  return connection?.id ?? null
}
