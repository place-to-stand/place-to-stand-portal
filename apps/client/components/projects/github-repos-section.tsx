'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLinkIcon, Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { GitHubMark } from '@/components/icons/github-mark'
import { useGitHubCallbackNotice } from '@/lib/hooks/use-github-callback-notice'

interface RepoOption {
  fullName: string
  owner: string
  name: string
  defaultBranch: string
}

interface RepoLink {
  id: string
  repoFullName: string
  defaultBranch: string
}

interface ReposResponse {
  ok: boolean
  data?: {
    repos: RepoOption[]
    hasInstallation: boolean
  }
}

interface LinksResponse {
  ok: boolean
  data?: { links: RepoLink[] }
}

export function GitHubRepoSection({
  projectId,
  clientId,
}: {
  projectId: string
  clientId: string
}) {
  const { notice, error: callbackError } = useGitHubCallbackNotice(
    `/projects/${projectId}`
  )

  const [loading, setLoading] = useState(true)
  const [hasInstallation, setHasInstallation] = useState(false)
  const [availableRepos, setAvailableRepos] = useState<RepoOption[]>([])
  const [links, setLinks] = useState<RepoLink[]>([])
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)

  const [unlinkTarget, setUnlinkTarget] = useState<RepoLink | null>(null)
  const [unlinking, setUnlinking] = useState(false)

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
      setAvailableRepos(reposJson.data.repos)

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

  const linkedFullNames = new Set(links.map(l => l.repoFullName))
  const pickableRepos = availableRepos.filter(r => !linkedFullNames.has(r.fullName))

  const handleLink = async () => {
    if (!selectedRepo) return
    const repo = availableRepos.find(r => r.fullName === selectedRepo)
    if (!repo) return

    setLinking(true)
    setError(null)
    try {
      const res = await fetch('/api/github/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          clientId,
          repoOwner: repo.owner,
          repoName: repo.name,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Failed to link repository')
      }
      setDialogOpen(false)
      setSelectedRepo(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link repository')
    } finally {
      setLinking(false)
    }
  }

  const handleUnlink = async () => {
    if (!unlinkTarget) return
    setUnlinking(true)
    try {
      const res = await fetch(`/api/github/link/${unlinkTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to remove repository')
      }
      setUnlinkTarget(null)
      await load()
    } catch {
      setError('Failed to remove repository.')
      setUnlinkTarget(null)
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          GitHub
        </h2>
        {hasInstallation && !loading && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setDialogOpen(true)}
            disabled={pickableRepos.length === 0}
          >
            <PlusIcon className="size-3.5" />
            Link repository
          </Button>
        )}
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
            Connect GitHub to link repositories to this project.
          </p>
          <Button variant="outline" size="xs" className="shrink-0" asChild>
            <a
              href={`/api/github/install?clientId=${clientId}&projectId=${projectId}&returnTo=/projects/${projectId}`}
            >
              Connect GitHub
            </a>
          </Button>
        </div>
      ) : links.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No repositories linked yet.
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
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {link.defaultBranch}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setUnlinkTarget(link)}
                    aria-label={`Remove ${link.repoFullName}`}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link a repository</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedRepo ?? ''} onValueChange={setSelectedRepo}>
              <SelectTrigger>
                <SelectValue placeholder="Select a repository" />
              </SelectTrigger>
              <SelectContent>
                {pickableRepos.map(repo => (
                  <SelectItem key={repo.fullName} value={repo.fullName}>
                    {repo.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={linking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleLink}
              disabled={!selectedRepo || linking}
            >
              {linking ? 'Linking...' : 'Link repository'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!unlinkTarget}
        title="Remove repository?"
        description={
          unlinkTarget
            ? `${unlinkTarget.repoFullName} will be unlinked from this project.`
            : undefined
        }
        confirmLabel={unlinking ? 'Removing...' : 'Remove'}
        confirmVariant="destructive"
        confirmDisabled={unlinking}
        onConfirm={handleUnlink}
        onCancel={() => setUnlinkTarget(null)}
      />
    </section>
  )
}
