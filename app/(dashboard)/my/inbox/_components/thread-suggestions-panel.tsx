'use client'

import {
  Sparkles,
  Loader2,
  ListTodo,
  GitPullRequest,
  ExternalLink,
  RefreshCw,
  Building2,
} from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type SuggestionSummary = {
  id: string
  type: 'TASK' | 'PR' | 'REPLY'
  status: string
  confidence: string
  title?: string
  createdAt: string
  projectName?: string | null
  projectSlug?: string | null
  clientSlug?: string | null
}

type ThreadSuggestionsPanelProps = {
  threadId: string
  isAdmin: boolean
  /** Change this value to trigger a re-fetch of suggestions */
  refreshTrigger?: number
  /** Whether analysis is currently running */
  isAnalyzing?: boolean
  /** Whether the thread has a client linked */
  hasClient?: boolean
  /** Whether the thread has a project linked */
  hasProject?: boolean
  /** Callback to refresh/re-analyze suggestions */
  onRefresh?: () => void
}

async function fetchThreadSuggestions(
  threadId: string
): Promise<SuggestionSummary[]> {
  const res = await fetch(`/api/threads/${threadId}/ai-suggestions`)
  const data = await res.json()
  if (data.ok) {
    return data.suggestions || []
  }
  return []
}

export function ThreadSuggestionsPanel({
  threadId,
  isAdmin,
  refreshTrigger = 0,
  isAnalyzing = false,
  hasClient = false,
  hasProject = false,
  onRefresh,
}: ThreadSuggestionsPanelProps) {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['thread-suggestions', threadId, refreshTrigger],
    queryFn: () => fetchThreadSuggestions(threadId),
    enabled: isAdmin,
  })

  // Get the project URL for "View in project" button
  const getProjectUrl = (suggestion: SuggestionSummary) => {
    if (suggestion.clientSlug && suggestion.projectSlug) {
      return `/projects/${suggestion.clientSlug}/${suggestion.projectSlug}/board?suggestions=open`
    }
    return null
  }

  // Get status badge variant and label
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          variant: 'default' as const,
          label: 'Approved',
          className: 'bg-green-500/10 text-green-600',
        }
      case 'REJECTED':
        return {
          variant: 'default' as const,
          label: 'Rejected',
          className: 'bg-red-500/10 text-red-600',
        }
      case 'PENDING':
      case 'DRAFT':
      case 'MODIFIED':
      default:
        return {
          variant: 'secondary' as const,
          label: 'Pending',
          className: '',
        }
    }
  }

  if (!isAdmin) return null

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Sparkles className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Suggestions</span>
        </div>
        {onRefresh && hasClient && hasProject && (
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6'
            onClick={onRefresh}
            disabled={isAnalyzing || isLoading}
            title='Re-analyze thread'
          >
            <RefreshCw
              className={`text-muted-foreground h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`}
            />
          </Button>
        )}
      </div>

      {isAnalyzing ? (
        <div className='bg-muted/30 flex items-center gap-2 rounded-lg border p-3'>
          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
          <span className='text-muted-foreground text-sm'>
            Analyzing emails...
          </span>
        </div>
      ) : isLoading ? (
        <div className='bg-muted/30 flex items-center gap-2 rounded-lg border p-3'>
          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
          <span className='text-muted-foreground text-sm'>
            Loading suggestions...
          </span>
        </div>
      ) : suggestions.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          {!hasClient && !hasProject
            ? 'Link a client and project to generate suggestions.'
            : !hasClient
              ? 'Link a client to generate suggestions.'
              : !hasProject
                ? 'Link a project to generate suggestions.'
                : 'No suggestions for this thread.'}
        </p>
      ) : (
        <div className='space-y-2'>
          {suggestions.map(suggestion => {
            const statusBadge = getStatusBadge(suggestion.status)
            const projectUrl = getProjectUrl(suggestion)

            return (
              <div
                key={suggestion.id}
                className='bg-muted/30 space-y-2 rounded-lg border p-3'
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex min-w-0 items-center gap-2'>
                    {suggestion.type === 'TASK' ? (
                      <ListTodo className='h-4 w-4 shrink-0 text-violet-500' />
                    ) : suggestion.type === 'PR' ? (
                      <GitPullRequest className='h-4 w-4 shrink-0 text-green-500' />
                    ) : null}
                    <span className='truncate text-sm font-medium'>
                      {suggestion.title || 'Untitled'}
                    </span>
                  </div>
                  <Badge variant='secondary' className='shrink-0 text-xs'>
                    {Math.round(parseFloat(suggestion.confidence) * 100)}%
                  </Badge>
                </div>

                <div className='flex items-center gap-2 pt-1'>
                  <Badge
                    variant={statusBadge.variant}
                    className={`text-xs ${statusBadge.className}`}
                  >
                    {statusBadge.label}
                  </Badge>
                  {projectUrl && (
                    <Button
                      size='sm'
                      variant='ghost'
                      className='h-7 text-xs'
                      asChild
                    >
                      <Link href={projectUrl}>
                        View in project
                        <ExternalLink className='mb-0.25 h-3! w-3!' />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
