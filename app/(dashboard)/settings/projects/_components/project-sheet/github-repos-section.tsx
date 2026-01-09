'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Github, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import type { GitHubRepoLink } from '@/lib/types/github'

export interface PendingRepo {
  repoFullName: string
}

export interface RemovedRepo {
  id: string
  repoFullName: string
}

interface GitHubReposSectionProps {
  projectId?: string
  disabled?: boolean
  // Controlled state from parent (for undo/redo support)
  pendingRepos: PendingRepo[]
  removedRepoIds: Set<string>
  onPendingReposChange: (repos: PendingRepo[]) => void
  onRemovedRepoIdsChange: (ids: Set<string>) => void
  onDirtyChange?: (isDirty: boolean) => void
}

interface RepoOption {
  value: string
  label: string
  description?: string
}

export function GitHubReposSection({
  projectId,
  disabled = false,
  pendingRepos,
  removedRepoIds,
  onPendingReposChange,
  onRemovedRepoIdsChange,
  onDirtyChange,
}: GitHubReposSectionProps) {
  const [repos, setRepos] = useState<GitHubRepoLink[]>([])
  const [loading, setLoading] = useState(true)
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [availableRepos, setAvailableRepos] = useState<RepoOption[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<GitHubRepoLink | null>(
    null
  )
  const [pendingDeleteConfirm, setPendingDeleteConfirm] =
    useState<PendingRepo | null>(null)
  const initialRepoCountRef = useRef<number | null>(null)

  const isCreateMode = !projectId

  // Check GitHub connection status
  useEffect(() => {
    fetch('/api/integrations/github/status')
      .then(r => r.json())
      .then(data =>
        setIsGitHubConnected(
          data.connected || (data.accounts && data.accounts.length > 0)
        )
      )
      .catch(() => setIsGitHubConnected(false))
  }, [])

  // Load linked repos (only in edit mode)
  const loadLinkedRepos = useCallback(async () => {
    if (!projectId) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/github-repos`)
      if (res.ok) {
        const data = await res.json()
        const loadedRepos = data.repos || []
        setRepos(loadedRepos)
        // Track initial count for dirty state comparison
        if (initialRepoCountRef.current === null) {
          initialRepoCountRef.current = loadedRepos.length
        }
      }
    } catch {
      // Ignore errors for now
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadLinkedRepos()
  }, [loadLinkedRepos])

  // Notify parent of dirty state changes
  useEffect(() => {
    if (!onDirtyChange) return

    // Create mode: dirty if any pending repos
    if (isCreateMode) {
      onDirtyChange(pendingRepos.length > 0)
      return
    }

    // Edit mode: dirty if pending repos added or repos removed
    const hasPending = pendingRepos.length > 0
    const hasRemoved = removedRepoIds.size > 0
    onDirtyChange(hasPending || hasRemoved)
  }, [isCreateMode, onDirtyChange, pendingRepos.length, removedRepoIds.size])

  // Load available repos when dialog opens
  useEffect(() => {
    if (dialogOpen && isGitHubConnected) {
      setLoadingRepos(true)
      fetch('/api/integrations/github/repos')
        .then(r => r.json())
        .then(data => {
          if (data.repos) {
            // Exclude both linked repos AND pending repos (for both create and edit modes)
            const linkedFullNames = repos.map(r => r.repoFullName)
            const pendingFullNames = pendingRepos.map(r => r.repoFullName)
            const excludedNames = new Set([...linkedFullNames, ...pendingFullNames])
            setAvailableRepos(
              data.repos
                .filter(
                  (r: { fullName: string }) => !excludedNames.has(r.fullName)
                )
                .map((r: { fullName: string; description?: string }) => ({
                  value: r.fullName,
                  label: r.fullName,
                  description: r.description || undefined,
                }))
            )
          }
        })
        .catch(() => {
          toast({
            title: 'Error',
            description: 'Failed to load repositories',
            variant: 'destructive',
          })
        })
        .finally(() => setLoadingRepos(false))
    }
  }, [dialogOpen, isGitHubConnected, repos, pendingRepos])

  const handleLink = () => {
    if (!selectedRepo) return

    // Always add to pending list (for both create and edit modes)
    // Repos get linked when the form is saved
    onPendingReposChange([...pendingRepos, { repoFullName: selectedRepo }])
    setDialogOpen(false)
    setSelectedRepo(null)
    toast({
      title: 'Repository added',
      description: `${selectedRepo} will be linked when you save.`,
    })
  }

  const handleRemovePending = () => {
    if (!pendingDeleteConfirm) return
    onPendingReposChange(
      pendingRepos.filter(r => r.repoFullName !== pendingDeleteConfirm.repoFullName)
    )
    setPendingDeleteConfirm(null)
    toast({ title: 'Repository removed' })
  }

  const handleUnlink = () => {
    if (!deleteConfirm) return

    // Mark repo for removal on save (don't immediately delete)
    onRemovedRepoIdsChange(new Set([...removedRepoIds, deleteConfirm.id]))
    setDeleteConfirm(null)
    toast({
      title: 'Repository marked for removal',
      description: 'Changes will be applied when you save.',
    })
  }

  if (!isGitHubConnected) {
    return (
      <div className='space-y-1'>
        <h3 className='text-sm font-medium'>GitHub Repositories</h3>
        <div className='rounded-lg border border-dashed p-4 text-center'>
          <Github className='text-muted-foreground mx-auto h-6 w-6' />
          <p className='text-muted-foreground mt-2 text-sm'>
            Connect your GitHub account in Settings to link repositories.
          </p>
          <Button variant='outline' size='sm' className='mt-3' asChild>
            <a href='/settings/integrations'>Go to Integrations</a>
          </Button>
        </div>
      </div>
    )
  }

  if (loading && !isCreateMode) {
    return (
      <div className='space-y-1'>
        <h3 className='text-sm font-medium'>GitHub Repositories</h3>
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='h-4 w-4 animate-spin' />
          Loading linked repos...
        </div>
      </div>
    )
  }

  // Determine which repos to display
  // In edit mode: show linked repos (excluding removed) + pending repos
  // In create mode: show only pending repos
  const displayRepos = isCreateMode
    ? []
    : repos.filter(r => !removedRepoIds.has(r.id))
  const removedRepos = isCreateMode
    ? []
    : repos.filter(r => removedRepoIds.has(r.id))
  const hasNoRepos =
    displayRepos.length === 0 &&
    pendingRepos.length === 0 &&
    removedRepos.length === 0

  return (
    <div className='space-y-1'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-sm font-medium'>GitHub Repositories</h3>
        <Button
          type='button'
          variant='ghost'
          size='xs'
          onClick={() => setDialogOpen(true)}
          disabled={disabled}
          aria-label='Link repository'
        >
          <Plus className='h-4 w-4' />
        </Button>
      </div>

      {hasNoRepos ? (
        <div className='rounded-lg border border-dashed p-4 text-center'>
          <Github className='text-muted-foreground mx-auto h-6 w-6' />
          <p className='text-muted-foreground mt-2 text-sm'>
            {isCreateMode
              ? 'No repositories selected. Add repos to link when you save.'
              : 'No repositories linked. Link a repo to enable PR creation.'}
          </p>
        </div>
      ) : (
        <div className='space-y-2'>
          {/* Linked repos (edit mode) */}
          {displayRepos.map(repo => (
            <div
              key={repo.id}
              className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'
            >
              <div className='flex min-w-0 flex-col gap-1'>
                <div className='flex items-center gap-2 text-sm'>
                  <Github className='text-muted-foreground h-4 w-4 shrink-0' />
                  <a
                    href={`https://github.com/${repo.repoFullName}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='truncate hover:underline'
                  >
                    {repo.repoFullName}
                    <ExternalLink className='text-muted-foreground ml-1 inline h-3 w-3' />
                  </a>
                </div>
                <div className='text-muted-foreground pl-6 text-xs'>
                  {repo.defaultBranch}
                </div>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-destructive h-7 w-7 shrink-0'
                onClick={() => setDeleteConfirm(repo)}
                disabled={disabled}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
          ))}
          {/* Pending repos (both modes) */}
          {pendingRepos.map(repo => (
            <div
              key={`pending-${repo.repoFullName}`}
              className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'
            >
              <div className='flex min-w-0 flex-col gap-1'>
                <div className='flex items-center gap-2 text-sm'>
                  <Github className='text-muted-foreground h-4 w-4 shrink-0' />
                  <span className='truncate'>{repo.repoFullName}</span>
                </div>
                <div className='pl-6 text-xs text-amber-600'>Pending save</div>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-destructive h-7 w-7 shrink-0'
                onClick={() => setPendingDeleteConfirm(repo)}
                disabled={disabled}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
          ))}
          {/* Removed repos (edit mode) */}
          {removedRepos.map(repo => (
            <div
              key={`removed-${repo.id}`}
              className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2 opacity-60'
            >
              <div className='flex min-w-0 flex-col gap-1'>
                <div className='flex items-center gap-2 text-sm line-through'>
                  <Github className='text-muted-foreground h-4 w-4 shrink-0' />
                  <span className='truncate'>{repo.repoFullName}</span>
                </div>
                <div className='pl-6 text-xs text-red-600'>Pending removal</div>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground h-7 w-7 shrink-0'
                onClick={() => {
                  const next = new Set(removedRepoIds)
                  next.delete(repo.id)
                  onRemovedRepoIdsChange(next)
                }}
                disabled={disabled}
                aria-label='Undo removal'
                title='Undo removal'
              >
                <span className='text-xs'>Undo</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Link Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add GitHub Repository</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 pt-4'>
            {loadingRepos ? (
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Loading repositories...
              </div>
            ) : (
              <SearchableCombobox
                items={availableRepos}
                value={selectedRepo ?? ''}
                onChange={setSelectedRepo}
                searchPlaceholder='Search repositories...'
                emptyMessage='No repositories found'
              />
            )}
            <div className='flex justify-end gap-2'>
              <Button variant='outline' onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleLink} disabled={!selectedRepo}>
                Add Repository
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Pending Confirmation (create mode) */}
      <ConfirmDialog
        open={!!pendingDeleteConfirm}
        title='Remove repository?'
        description={`Remove ${pendingDeleteConfirm?.repoFullName} from the list?`}
        confirmLabel='Remove'
        cancelLabel='Cancel'
        confirmVariant='destructive'
        onConfirm={handleRemovePending}
        onCancel={() => setPendingDeleteConfirm(null)}
      />

      {/* Unlink Confirmation (edit mode) */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title='Remove repository?'
        description={`Remove ${deleteConfirm?.repoFullName}? The change will be applied when you save.`}
        confirmLabel='Remove'
        cancelLabel='Cancel'
        confirmVariant='destructive'
        onConfirm={handleUnlink}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
