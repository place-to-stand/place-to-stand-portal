import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { githubRepoLinks, projectIntegrationLinks } from '@/lib/db/schema'
import {
  archiveRepoLink,
  logRepoLinked,
  logRepoUnlinked,
  writeRepoLink,
  type RepoLinkInput,
} from '@/lib/data/github-repos'
import {
  archiveIntegrationLink,
  logIntegrationLinked,
  logIntegrationUnlinked,
  writeIntegrationLink,
} from '@/lib/data/project-integration-links'
import {
  getActiveInstallationForCompany,
  type ActiveAppInstallation,
} from '@/lib/github/app-installations'
import { resolveRepoForLink } from '@/lib/github/resolve-repo-link'
import {
  IntegrationNotConnectedError,
  InvalidIntegrationTokenError,
} from '@/lib/integrations/connections'
import { findExternalProjectsForUser } from '@/lib/integrations/find-external-projects'
import type { GitHubRepoLink } from '@/lib/types/github'
import {
  INTEGRATION_PROVIDERS,
  type ExternalProjectOption,
  type ProjectIntegrationLink,
} from '@/lib/types/integrations'

import type { ProjectInput } from './project-service'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Every link change, checked against GitHub / Vercel / Supabase. */
export type PreparedLinkChanges = {
  repoAdds: RepoLinkInput[]
  repoRemovals: GitHubRepoLink[]
  integrationAdds: ExternalProjectOption[]
  integrationRemovals: ProjectIntegrationLink[]
}

export type WrittenLinkChanges = {
  linkedRepos: string[]
  unlinkedRepos: GitHubRepoLink[]
  linkedIntegrations: ExternalProjectOption[]
  unlinkedIntegrations: ProjectIntegrationLink[]
}

const NO_CHANGES: PreparedLinkChanges = {
  repoAdds: [],
  repoRemovals: [],
  integrationAdds: [],
  integrationRemovals: [],
}

/**
 * Does every outside call a save's link changes need — GitHub repo lookups,
 * Vercel/Supabase project listings — and loads the rows being removed, all
 * before the save opens its transaction. Nothing is written here; the first
 * problem comes back as `{ error }` and the save writes nothing.
 *
 * `companyId` is the client the project will have after the save: a repo
 * picked through the client's GitHub App must belong to its installation.
 */
export async function prepareProjectLinkChanges(args: {
  user: Pick<AppUser, 'id'>
  projectId: string | null
  companyId: string | null
  repoLinks: ProjectInput['repoLinks']
  integrationLinks: ProjectInput['integrationLinks']
}): Promise<{ prepared: PreparedLinkChanges } | { error: string }> {
  const { user, projectId, companyId } = args
  const repoAddRequests = args.repoLinks?.add ?? []
  const repoRemoveIds = Array.from(new Set(args.repoLinks?.remove ?? []))
  const integrationAddRequests = args.integrationLinks?.add ?? []
  const integrationRemoveIds = Array.from(
    new Set(args.integrationLinks?.remove ?? [])
  )

  if (
    !repoAddRequests.length &&
    !repoRemoveIds.length &&
    !integrationAddRequests.length &&
    !integrationRemoveIds.length
  ) {
    return { prepared: NO_CHANGES }
  }

  if (!projectId && (repoRemoveIds.length || integrationRemoveIds.length)) {
    return { error: 'A new project has no links to remove.' }
  }

  const [repoRemovals, integrationRemovals] = await Promise.all([
    loadRepoLinksToRemove(projectId, repoRemoveIds),
    loadIntegrationLinksToRemove(projectId, integrationRemoveIds),
  ])
  if (
    repoRemovals.length !== repoRemoveIds.length ||
    integrationRemovals.length !== integrationRemoveIds.length
  ) {
    // Already unlinked elsewhere, or not this project's: reload and retry.
    return {
      error: 'The project’s links changed since you opened it. Reopen it and try again.',
    }
  }

  let installation: Promise<ActiveAppInstallation | null> | null = null
  const loadInstallation = () => {
    installation ??= companyId
      ? getActiveInstallationForCompany(companyId)
      : Promise.resolve(null)
    return installation
  }

  const repoResults = await Promise.all(
    repoAddRequests.map(request =>
      resolveRepoForLink(
        user.id,
        {
          repoFullName: request.repoFullName,
          ...(request.source === 'app'
            ? { githubAppInstallationId: request.sourceId }
            : request.source === 'oauth'
              ? { connectionId: request.sourceId }
              : {}),
        },
        loadInstallation
      ).then(result => ({ request, result }))
    )
  )
  const repoAdds: RepoLinkInput[] = []
  for (const { request, result } of repoResults) {
    if (!result.ok) return { error: `${request.repoFullName}: ${result.error}` }
    repoAdds.push(result.repo)
  }

  let integrationAdds: ExternalProjectOption[] = []
  if (integrationAddRequests.length) {
    try {
      const { options, missing } = await findExternalProjectsForUser(
        user.id,
        integrationAddRequests
      )
      if (missing.length) {
        const label = INTEGRATION_PROVIDERS[missing[0].provider].label
        return {
          error: `That ${label} project is not visible to your connected accounts.`,
        }
      }
      integrationAdds = options
    } catch (error) {
      if (
        error instanceof IntegrationNotConnectedError ||
        error instanceof InvalidIntegrationTokenError
      ) {
        return { error: error.message }
      }
      console.error('[projects] hosting project lookup failed', error)
      return { error: 'Could not reach Vercel or Supabase. Try again.' }
    }
  }

  return {
    prepared: { repoAdds, repoRemovals, integrationAdds, integrationRemovals },
  }
}

/** Live repo links of this project with these ids. */
async function loadRepoLinksToRemove(
  projectId: string | null,
  ids: string[]
): Promise<GitHubRepoLink[]> {
  if (!projectId || !ids.length) return []
  return db
    .select()
    .from(githubRepoLinks)
    .where(
      and(
        inArray(githubRepoLinks.id, ids),
        eq(githubRepoLinks.projectId, projectId),
        isNull(githubRepoLinks.deletedAt)
      )
    )
}

/** Live hosting links of this project with these ids. */
async function loadIntegrationLinksToRemove(
  projectId: string | null,
  ids: string[]
): Promise<ProjectIntegrationLink[]> {
  if (!projectId || !ids.length) return []
  return db
    .select()
    .from(projectIntegrationLinks)
    .where(
      and(
        inArray(projectIntegrationLinks.id, ids),
        eq(projectIntegrationLinks.projectId, projectId),
        isNull(projectIntegrationLinks.deletedAt)
      )
    )
}

/** Writes prepared link changes inside the save's transaction. */
export async function writeProjectLinkChanges(
  tx: DbTransaction,
  projectId: string,
  prepared: PreparedLinkChanges,
  actorId: string
): Promise<WrittenLinkChanges> {
  const written: WrittenLinkChanges = {
    linkedRepos: [],
    unlinkedRepos: prepared.repoRemovals,
    linkedIntegrations: [],
    unlinkedIntegrations: prepared.integrationRemovals,
  }

  // Removals first, so removing and re-adding a link in one save restores it.
  for (const link of prepared.repoRemovals) {
    await archiveRepoLink(tx, link.id)
  }
  for (const link of prepared.integrationRemovals) {
    await archiveIntegrationLink(tx, link.id)
  }
  for (const repo of prepared.repoAdds) {
    const { created } = await writeRepoLink(tx, projectId, repo, actorId)
    if (created) written.linkedRepos.push(repo.repoFullName)
  }
  for (const option of prepared.integrationAdds) {
    const { created } = await writeIntegrationLink(tx, projectId, option, actorId)
    if (created) written.linkedIntegrations.push(option)
  }

  return written
}

/** Activity rows for committed link changes (after the transaction). */
export async function logProjectLinkChanges(
  actor: Pick<AppUser, 'id' | 'role'>,
  projectId: string,
  written: WrittenLinkChanges
): Promise<void> {
  await Promise.all([
    ...written.unlinkedRepos.map(link => logRepoUnlinked(actor, link)),
    ...written.unlinkedIntegrations.map(link =>
      logIntegrationUnlinked(actor, link)
    ),
    ...written.linkedRepos.map(name => logRepoLinked(actor, projectId, name)),
    ...written.linkedIntegrations.map(option =>
      logIntegrationLinked(actor, projectId, option)
    ),
  ])
}
