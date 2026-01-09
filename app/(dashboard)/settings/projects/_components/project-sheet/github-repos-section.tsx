'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Github, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

interface GitHubReposSectionProps {
  projectId: string
  projectName: string
  disabled?: boolean
}

interface RepoOption {
  value: string
  label: string
  description?: string
}

export function GitHubReposSection({
  projectId,
  projectName: _projectName,
  disabled = false,
}: GitHubReposSectionProps) {
  const [repos, setRepos] = useState<GitHubRepoLink[]>([])
  const [loading, setLoading] = useState(true)
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [availableRepos, setAvailableRepos] = useState<RepoOption[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<GitHubRepoLink | null>(
    null
  )
  const [unlinking, setUnlinking] = useState(false)

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

  // Load linked repos
  const loadLinkedRepos = useCallback(async () => {
    if (!projectId) return

    try {
      const res = await fetch(`/api/projects/${projectId}/github-repos`)
      if (res.ok) {
        const data = await res.json()
        setRepos(data.repos || [])
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

  // Load available repos when dialog opens
  useEffect(() => {
    if (dialogOpen && isGitHubConnected) {
      setLoadingRepos(true)
      fetch('/api/integrations/github/repos')
        .then(r => r.json())
        .then(data => {
          if (data.repos) {
            const linkedFullNames = repos.map(r => r.repoFullName)
            setAvailableRepos(
              data.repos
                .filter(
                  (r: { fullName: string }) =>
                    !linkedFullNames.includes(r.fullName)
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
  }, [dialogOpen, isGitHubConnected, repos])

  const handleLink = async () => {
    if (!selectedRepo) return

    setLinking(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/github-repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: selectedRepo }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to link')
      }

      const data = await response.json()
      setRepos(prev => [...prev, data.link])
      setDialogOpen(false)
      setSelectedRepo(null)

      toast({
        title: 'Repository linked',
        description: `${selectedRepo} is now linked.`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to link repository',
        variant: 'destructive',
      })
    } finally {
      setLinking(false)
    }
  }

  const handleUnlink = async () => {
    if (!deleteConfirm) return

    setUnlinking(true)
    try {
      const res = await fetch(
        `/api/projects/${projectId}/github-repos/${deleteConfirm.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!res.ok) throw new Error('Failed to unlink')

      setRepos(prev => prev.filter(r => r.id !== deleteConfirm.id))
      toast({ title: 'Repository unlinked' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink repository',
        variant: 'destructive',
      })
    } finally {
      setUnlinking(false)
      setDeleteConfirm(null)
    }
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

  if (loading) {
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

      {repos.length === 0 ? (
        <div className='rounded-lg border border-dashed p-4 text-center'>
          <Github className='text-muted-foreground mx-auto h-6 w-6' />
          <p className='text-muted-foreground mt-2 text-sm'>
            No repositories linked. Link a repo to enable PR creation.
          </p>
        </div>
      ) : (
        <div className='space-y-2'>
          {repos.map(repo => (
            <div
              key={repo.id}
              className='bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2'
            >
              <div className='flex items-center gap-2 text-sm'>
                <Github className='text-muted-foreground h-4 w-4' />
                <a
                  href={`https://github.com/${repo.repoFullName}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='hover:underline'
                >
                  {repo.repoFullName}
                  <ExternalLink className='text-muted-foreground ml-1 inline h-3 w-3' />
                </a>
                <Badge variant='outline' className='text-xs'>
                  {repo.defaultBranch}
                </Badge>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-destructive h-7 w-7'
                onClick={() => setDeleteConfirm(repo)}
                disabled={disabled}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Link Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link GitHub Repository</DialogTitle>
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
              <Button onClick={handleLink} disabled={!selectedRepo || linking}>
                {linking ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Linking...
                  </>
                ) : (
                  'Link Repository'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title='Unlink repository?'
        description={`Are you sure you want to unlink ${deleteConfirm?.repoFullName}? This will also remove any pending PR suggestions for this repository.`}
        confirmLabel={unlinking ? 'Unlinking...' : 'Unlink'}
        cancelLabel='Cancel'
        confirmVariant='destructive'
        onConfirm={handleUnlink}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
