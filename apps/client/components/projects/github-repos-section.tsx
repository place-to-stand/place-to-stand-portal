'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLinkIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GitHubMark } from '@/components/icons/github-mark'
import { useGitHubCallbackNotice } from '@/lib/hooks/use-github-callback-notice'
import { StaffAuthorizationModal } from '@/components/projects/staff-authorization-modal'
import type { PtsStaffGitHubAccount } from '@/lib/data/staff-github-access'

interface RepoLink {
  id: string
  repoFullName: string
  defaultBranch: string
}

interface ReposResponse {
  ok: boolean
  data?: { hasInstallation: boolean }
}

interface LinksResponse {
  ok: boolean
  data?: { links: RepoLink[] }
}

export function GitHubRepoSection({
  projectId,
  clientId,
  staffAccounts,
}: {
  projectId: string
  clientId: string
  staffAccounts: PtsStaffGitHubAccount[]
}) {
  const { notice, error: callbackError } = useGitHubCallbackNotice(
    `/projects/${projectId}`
  )

  const [loading, setLoading] = useState(true)
  const [hasInstallation, setHasInstallation] = useState(false)
  const [links, setLinks] = useState<RepoLink[]>([])
  const [error, setError] = useState<string | null>(null)

  const [staffModalOpen, setStaffModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const reposRes = await fetch(`/api/github/repos?clientId=${clientId}`)
      const reposJson = (await reposRes.json()) as ReposResponse

      if (!reposRes.ok || !reposJson.ok || !reposJson.data) {
        throw new Error('Failed to load GitHub connection status')
      }

      setHasInstallation(reposJson.data.hasInstallation)

      if (reposJson.data.hasInstallation) {
        const linksRes = await fetch(`/api/github/link?projectId=${projectId}`)
        const linksJson = (await linksRes.json()) as LinksResponse

        if (!linksRes.ok || !linksJson.ok || !linksJson.data) {
          throw new Error('Failed to load linked repositories')
        }

        setLinks(linksJson.data.links)
      } else {
        setLinks([])
      }
    } catch {
      setError('Something went wrong loading GitHub repositories.')
    } finally {
      setLoading(false)
    }
  }, [clientId, projectId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() syncs component state with the GitHub API/DB (an external system)
    void load()
  }, [load])

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          GitHub
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {!loading && (
            <Button
              type="button"
              variant={hasInstallation ? 'outline' : 'default'}
              size="xs"
              className="gap-1.5"
              disabled={hasInstallation}
              asChild={!hasInstallation}
            >
              {hasInstallation ? (
                <>
                  <GitHubMark className="size-3.5" />
                  Agent authorized
                </>
              ) : (
                <a
                  href={`/api/github/install?clientId=${clientId}&projectId=${projectId}&returnTo=/projects/${projectId}`}
                >
                  <GitHubMark className="size-3.5" />
                  Authorize agent
                </a>
              )}
            </Button>
          )}
          {!loading && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="gap-1.5"
              onClick={() => setStaffModalOpen(true)}
              disabled={links.length === 0}
              title={
                links.length === 0
                  ? 'Link a repository first'
                  : undefined
              }
            >
              <GitHubMark className="size-3.5" />
              Staff authorization
            </Button>
          )}
        </div>
      </div>

      {notice && <p className="text-xs text-emerald-600">{notice}</p>}
      {(callbackError ?? error) && (
        <p className="text-xs text-destructive" role="alert">
          {callbackError ?? error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading...
        </div>
      ) : !hasInstallation ? (
        <div className="flex items-center gap-3 rounded-lg border border-border p-4">
          <GitHubMark className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Authorize our agent above to link repositories to this project.
          </p>
        </div>
      ) : links.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No repositories linked yet. Contact your account manager to link
            one.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card px-4">
          <ul className="divide-y divide-border">
            {links.map(link => (
              <li
                key={link.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <a
                  href={`https://github.com/${link.repoFullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-1.5 text-sm text-card-foreground hover:underline"
                >
                  <GitHubMark className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{link.repoFullName}</span>
                  <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {link.defaultBranch}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <StaffAuthorizationModal
        open={staffModalOpen}
        onOpenChange={setStaffModalOpen}
        links={links}
        staffAccounts={staffAccounts}
      />
    </section>
  )
}
