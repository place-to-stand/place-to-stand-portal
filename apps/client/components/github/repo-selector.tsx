'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type Repo = {
  id: number
  name: string
  fullName: string
  owner: string
  defaultBranch: string
  private: boolean
  description: string | null
}

export function RepoSelector({
  projectId,
  clientId,
}: {
  projectId: string
  clientId: string
}) {
  const router = useRouter()
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRepo, setSelectedRepo] = useState('')
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    async function fetchRepos() {
      try {
        const res = await fetch(`/api/github/repos?clientId=${clientId}`)
        const json = await res.json()
        if (!json.ok) {
          setError(json.error ?? 'Failed to load repositories')
          return
        }
        setRepos(json.data.repos)
      } catch {
        setError('Failed to load repositories')
      } finally {
        setLoading(false)
      }
    }
    fetchRepos()
  }, [clientId])

  async function handleLink() {
    if (!selectedRepo) return

    const repo = repos.find(r => r.fullName === selectedRepo)
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
      if (!json.ok) {
        setError(json.error ?? 'Failed to link repository')
        return
      }
      router.refresh()
    } catch {
      setError('Failed to link repository')
    } finally {
      setLinking(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    )
  }

  if (repos.length === 0 && !error) {
    return (
      <p className="text-sm text-muted-foreground">
        No repositories found. Check that the GitHub App has access to your
        repositories.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <select
        value={selectedRepo}
        onChange={e => setSelectedRepo(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="">Select a repository...</option>
        {repos.map(repo => (
          <option key={repo.id} value={repo.fullName}>
            {repo.fullName}
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleLink}
        disabled={!selectedRepo || linking}
        size="sm"
      >
        {linking ? 'Linking...' : 'Link Repository'}
      </Button>
    </div>
  )
}
