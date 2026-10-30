import { eq, and, isNull, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { githubRepoLinks } from '@/lib/db/schema'
import { logActivity } from '@/lib/activity/logger'
import type { AppUser } from '@/lib/auth/session'
import type { GitHubRepoLink } from '@/lib/types/github'

/** The signed-in user performing the link/unlink; the role is never assumed. */
export type RepoLinkActor = Pick<AppUser, 'id' | 'role'>

/**
 * Get repos linked to a project
 */
export async function getProjectRepos(projectId: string): Promise<GitHubRepoLink[]> {
  return db
    .select()
    .from(githubRepoLinks)
    .where(
      and(
        eq(githubRepoLinks.projectId, projectId),
        isNull(githubRepoLinks.deletedAt)
      )
    )
}

/**
 * Get repos linked to multiple projects (batch fetch)
 */
export async function getReposForProjects(
  projectIds: string[]
): Promise<Map<string, GitHubRepoLink[]>> {
  if (projectIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .select()
    .from(githubRepoLinks)
    .where(
      and(
        inArray(githubRepoLinks.projectId, projectIds),
        isNull(githubRepoLinks.deletedAt)
      )
    )

  const reposByProject = new Map<string, GitHubRepoLink[]>()

  rows.forEach(row => {
    const existing = reposByProject.get(row.projectId) ?? []
    existing.push(row)
    reposByProject.set(row.projectId, existing)
  })

  return reposByProject
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
/** `db` or an open transaction, so a sheet save can write links in its own. */
export type RepoLinkExecutor = typeof db | DbTransaction

/** What a link row needs, resolved from GitHub before any write. */
export type RepoLinkInput = {
  oauthConnectionId?: string
  githubAppInstallationId?: string
  repoOwner: string
  repoName: string
  repoFullName: string
  repoId: number
  defaultBranch: string
}

/**
 * Writes a link row. A previously unlinked row for the same repo is restored
 * (and refreshed) rather than duplicated, because the unique key on
 * (project, repo) covers archived rows too. Returns `created: false` when the
 * repo was already linked, so the caller logs only real changes.
 */
export async function writeRepoLink(
  executor: RepoLinkExecutor,
  projectId: string,
  repo: RepoLinkInput,
  actorId: string
): Promise<{ link: GitHubRepoLink; created: boolean }> {
  const now = new Date().toISOString()
  const details = {
    oauthConnectionId: repo.oauthConnectionId ?? null,
    githubAppInstallationId: repo.githubAppInstallationId ?? null,
    repoOwner: repo.repoOwner,
    repoName: repo.repoName,
    repoFullName: repo.repoFullName,
    repoId: repo.repoId,
    defaultBranch: repo.defaultBranch,
    linkedBy: actorId,
  }

  const [existing] = await executor
    .select()
    .from(githubRepoLinks)
    .where(
      and(
        eq(githubRepoLinks.projectId, projectId),
        eq(githubRepoLinks.repoFullName, repo.repoFullName)
      )
    )
    .limit(1)

  if (existing && !existing.deletedAt) {
    return { link: existing, created: false }
  }

  if (existing) {
    const [restored] = await executor
      .update(githubRepoLinks)
      .set({ ...details, updatedAt: now, deletedAt: null })
      .where(eq(githubRepoLinks.id, existing.id))
      .returning()
    return { link: restored, created: true }
  }

  const [inserted] = await executor
    .insert(githubRepoLinks)
    .values({ projectId, ...details })
    .returning()
  return { link: inserted, created: true }
}

/** Archives a link row (soft delete). */
export async function archiveRepoLink(
  executor: RepoLinkExecutor,
  linkId: string
): Promise<void> {
  const now = new Date().toISOString()
  await executor
    .update(githubRepoLinks)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(githubRepoLinks.id, linkId))
}

export async function logRepoLinked(
  actor: RepoLinkActor,
  projectId: string,
  repoFullName: string
): Promise<void> {
  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    verb: 'GITHUB_REPO_LINKED',
    summary: `Linked repository ${repoFullName} to project`,
    targetType: 'PROJECT',
    targetId: projectId,
    targetProjectId: projectId,
    metadata: { repoFullName },
  })
}

export async function logRepoUnlinked(
  actor: RepoLinkActor,
  link: Pick<GitHubRepoLink, 'projectId' | 'repoFullName'>
): Promise<void> {
  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    verb: 'GITHUB_REPO_UNLINKED',
    summary: `Unlinked repository ${link.repoFullName}`,
    targetType: 'PROJECT',
    targetId: link.projectId,
    targetProjectId: link.projectId,
    metadata: { repoFullName: link.repoFullName },
  })
}

/**
 * Link a repository to a project
 */
export async function linkRepoToProject(
  projectId: string,
  repo: RepoLinkInput,
  actor: RepoLinkActor
): Promise<GitHubRepoLink> {
  const { link, created } = await writeRepoLink(db, projectId, repo, actor.id)
  if (created) {
    await logRepoLinked(actor, projectId, repo.repoFullName)
  }
  return link
}

/**
 * Unlink a repository from a project
 */
export async function unlinkRepo(
  linkId: string,
  actor: RepoLinkActor
): Promise<void> {
  const [link] = await db
    .select()
    .from(githubRepoLinks)
    .where(eq(githubRepoLinks.id, linkId))
    .limit(1)

  if (!link) throw new Error('Link not found')

  await archiveRepoLink(db, linkId)
  await logRepoUnlinked(actor, link)
}

/**
 * Get a single repo link by ID
 */
export async function getRepoLinkById(linkId: string): Promise<GitHubRepoLink | null> {
  const [link] = await db
    .select()
    .from(githubRepoLinks)
    .where(
      and(
        eq(githubRepoLinks.id, linkId),
        isNull(githubRepoLinks.deletedAt)
      )
    )
    .limit(1)

  return link ?? null
}
