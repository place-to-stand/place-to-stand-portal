import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

import type { ProjectWithRelations } from '@/lib/types'
import type { PRSuggestionWithContext } from '@/lib/types/github'

// Flat suggestion type matching the API response
export type ProjectSuggestion = {
  id: string
  type: string
  title: string
  description: string | null
  dueDate: string | null
  priority: string | null
  confidence: string
  reasoning: string | null
  status: string
  emailContext: {
    threadId: string | null
    subject: string | null
    fromEmail: string
    sentAt: string | null
  } | null
}

type SuggestionsMeta = {
  totalSuggestions: number
  pendingSuggestions: number
  approvedSuggestions: number
  rejectedSuggestions: number
  unanalyzedEmails: number
  hasGitHubRepos: boolean
  message?: string
}

export type SuggestionFilterType = 'pending' | 'approved' | 'rejected'

type TaskStatus = 'BACKLOG' | 'ON_DECK' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'DONE'

type GitHubRepoInfo = {
  id: string
  repoFullName: string
  defaultBranch: string
}

type CreatedTaskInfo = {
  taskId: string
  suggestionId: string
  title: string
  githubRepos: GitHubRepoInfo[]
}

type UseAISuggestionsSheetArgs = {
  activeProject: ProjectWithRelations | null
  currentUserId: string
}

const SUGGESTIONS_QUERY_PARAM = 'suggestions'

export function useAISuggestionsSheet({
  activeProject,
  currentUserId: _currentUserId,
}: UseAISuggestionsSheetArgs) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Initialize isOpen from URL query param
  const [isOpen, setIsOpen] = useState(
    () => searchParams.get(SUGGESTIONS_QUERY_PARAM) === 'open'
  )
  const [filter, setFilter] = useState<SuggestionFilterType>('pending')
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([])
  const [meta, setMeta] = useState<SuggestionsMeta | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingCount, setIsLoadingCount] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // PR generation state
  const [createdTaskInfo, setCreatedTaskInfo] = useState<CreatedTaskInfo | null>(null)
  const [isGeneratingPR, setIsGeneratingPR] = useState(false)
  const [isApprovingPR, setIsApprovingPR] = useState(false)
  const [prSuggestion, setPRSuggestion] = useState<PRSuggestionWithContext | null>(null)

  // Fetch just the count (lightweight, for badge on page load)
  const fetchCount = useCallback(async () => {
    if (!activeProject?.id) return

    setIsLoadingCount(true)

    try {
      const res = await fetch(
        `/api/projects/${activeProject.id}/ai-suggestions?countOnly=true`
      )
      if (!res.ok) {
        throw new Error('Failed to fetch count')
      }
      const data = await res.json()
      setMeta(data.meta || null)
    } catch {
      // Silently fail for count - it's not critical
    } finally {
      setIsLoadingCount(false)
    }
  }, [activeProject?.id])

  // Fetch full suggestions when sheet opens
  const fetchSuggestions = useCallback(async (filterOverride?: SuggestionFilterType) => {
    if (!activeProject?.id) return

    const currentFilter = filterOverride ?? filter
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/projects/${activeProject.id}/ai-suggestions?filter=${currentFilter}`
      )
      if (!res.ok) {
        throw new Error('Failed to fetch suggestions')
      }
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setMeta(data.meta || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [activeProject?.id, filter])

  // Fetch count on mount and when project changes (for badge display)
  useEffect(() => {
    if (activeProject?.id && activeProject?.client_id) {
      fetchCount()
    } else {
      // Reset meta when no valid project
      setMeta(null)
    }
  }, [activeProject?.id, activeProject?.client_id, fetchCount])

  // Refresh full data when sheet opens or filter changes
  useEffect(() => {
    if (isOpen && activeProject?.id) {
      fetchSuggestions()
    }
  }, [isOpen, activeProject?.id, filter, fetchSuggestions])

  // Handle filter change
  const handleFilterChange = useCallback((newFilter: SuggestionFilterType) => {
    setFilter(newFilter)
  }, [])

  // Sync URL query param when isOpen changes
  useEffect(() => {
    const currentValue = searchParams.get(SUGGESTIONS_QUERY_PARAM)
    const shouldBeOpen = currentValue === 'open'

    if (isOpen !== shouldBeOpen) {
      const params = new URLSearchParams(searchParams.toString())
      if (isOpen) {
        params.set(SUGGESTIONS_QUERY_PARAM, 'open')
      } else {
        params.delete(SUGGESTIONS_QUERY_PARAM)
      }
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      router.replace(newUrl, { scroll: false })
    }
  }, [isOpen, searchParams, pathname, router])

  // Handle opening the sheet
  const handleOpen = useCallback(() => {
    setIsOpen(true)
  }, [])

  // Handle sheet open/close
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Clear error when closing
      setError(null)
    }
  }, [])

  // Analyze unanalyzed emails
  const handleAnalyzeEmails = useCallback(async () => {
    if (!activeProject?.id) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/projects/${activeProject.id}/ai-suggestions`,
        { method: 'POST' }
      )
      if (!res.ok) {
        throw new Error('Failed to analyze emails')
      }
      // Refresh the list after analysis
      await fetchSuggestions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze emails')
    } finally {
      setIsAnalyzing(false)
    }
  }, [activeProject?.id, fetchSuggestions])

  // Create task from suggestion
  const handleCreateTask = useCallback(
    async (suggestionId: string, status: TaskStatus) => {
      if (!activeProject?.id) return

      setIsCreatingTask(suggestionId)
      setError(null)

      try {
        const res = await fetch(
          `/api/projects/${activeProject.id}/ai-suggestions/create-task`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suggestionId, status }),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to create task')
        }

        const data = await res.json()

        // If project has GitHub repos, show PR generation prompt
        if (data.githubRepos && data.githubRepos.length > 0) {
          setCreatedTaskInfo({
            taskId: data.task.id,
            suggestionId: data.suggestionId,
            title: data.task.title,
            githubRepos: data.githubRepos,
          })
        }

        // Refresh to remove the processed suggestion
        await fetchSuggestions()
        // Refresh the board to show the new task
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create task')
      } finally {
        setIsCreatingTask(null)
      }
    },
    [activeProject?.id, fetchSuggestions, router]
  )

  // Reject a suggestion
  const handleRejectSuggestion = useCallback(
    async (suggestionId: string, reason?: string) => {
      if (!activeProject?.id) return

      setIsCreatingTask(suggestionId)
      setError(null)

      try {
        const res = await fetch(
          `/api/projects/${activeProject.id}/ai-suggestions/create-task`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', suggestionId, reason }),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to reject suggestion')
        }

        // Refresh to remove the rejected suggestion
        await fetchSuggestions()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject suggestion')
      } finally {
        setIsCreatingTask(null)
      }
    },
    [activeProject?.id, fetchSuggestions]
  )

  // Unreject a suggestion (restore to pending)
  const handleUnrejectSuggestion = useCallback(
    async (suggestionId: string) => {
      if (!activeProject?.id) return

      setIsCreatingTask(suggestionId)
      setError(null)

      try {
        const res = await fetch(`/api/suggestions/${suggestionId}/unreject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to restore suggestion')
        }

        // Refresh to update the list
        await fetchSuggestions()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to restore suggestion')
      } finally {
        setIsCreatingTask(null)
      }
    },
    [activeProject?.id, fetchSuggestions]
  )

  // Generate PR suggestion from task
  const handleGeneratePR = useCallback(
    async (repoLinkId: string) => {
      if (!createdTaskInfo) return

      setIsGeneratingPR(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/suggestions/${createdTaskInfo.suggestionId}/generate-pr`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoLinkId }),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to generate PR suggestion')
        }

        const data = await res.json()
        setPRSuggestion(data.suggestion)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate PR')
      } finally {
        setIsGeneratingPR(false)
      }
    },
    [createdTaskInfo]
  )

  // Approve PR suggestion and create on GitHub
  const handleApprovePR = useCallback(
    async (modifications?: {
      title?: string
      body?: string
      branch?: string
      baseBranch?: string
      createNewBranch?: boolean
    }): Promise<{ prNumber: number; prUrl: string; branchCreated?: boolean } | null> => {
      if (!prSuggestion) return null

      setIsApprovingPR(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/pr-suggestions/${prSuggestion.id}/approve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(modifications || {}),
          }
        )

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to create PR')
        }

        const data = await res.json()

        // Clear PR flow state
        setCreatedTaskInfo(null)
        setPRSuggestion(null)

        return {
          prNumber: data.prNumber,
          prUrl: data.prUrl,
          branchCreated: data.branchCreated,
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create PR')
        return null
      } finally {
        setIsApprovingPR(false)
      }
    },
    [prSuggestion]
  )

  // Dismiss PR generation flow
  const handleDismissPR = useCallback(() => {
    setCreatedTaskInfo(null)
    setPRSuggestion(null)
    setError(null)
  }, [])

  // Computed values
  const pendingCount = meta?.pendingSuggestions ?? 0
  const approvedCount = meta?.approvedSuggestions ?? 0
  const rejectedCount = meta?.rejectedSuggestions ?? 0
  const unanalyzedCount = meta?.unanalyzedEmails ?? 0
  const hasGitHubRepos = meta?.hasGitHubRepos ?? false
  const disabled = !activeProject?.client_id
  const disabledReason = disabled
    ? 'AI suggestions require a client project with linked email threads'
    : null

  return {
    // Sheet state
    isOpen,
    onOpen: handleOpen,
    onOpenChange: handleOpenChange,

    // Filter state
    filter,
    onFilterChange: handleFilterChange,

    // Data
    suggestions,
    pendingCount,
    approvedCount,
    rejectedCount,
    unanalyzedCount,
    hasGitHubRepos,

    // Loading states
    isLoading,
    isAnalyzing,
    isCreatingTask,
    error,

    // Actions
    onRefresh: fetchSuggestions,
    onAnalyzeEmails: handleAnalyzeEmails,
    onCreateTask: handleCreateTask,
    onRejectSuggestion: handleRejectSuggestion,
    onUnrejectSuggestion: handleUnrejectSuggestion,

    // Disabled state
    disabled,
    disabledReason,

    // PR generation state
    createdTaskInfo,
    isGeneratingPR,
    isApprovingPR,
    prSuggestion,

    // PR generation actions
    onGeneratePR: handleGeneratePR,
    onApprovePR: handleApprovePR,
    onDismissPR: handleDismissPR,
  }
}

export type UseAISuggestionsSheetReturn = ReturnType<typeof useAISuggestionsSheet>
