'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Inbox, CheckCircle2, XCircle, Sparkles, Check, X } from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  SuggestionCard,
  type SuggestionCardData,
  type TaskStatus,
} from '@/components/suggestions/suggestion-card'
import { cn } from '@/lib/utils'
import type {
  SuggestionWithContext,
  TaskSuggestedContent,
  PRSuggestedContent,
} from '@/lib/types/suggestions'
import type { SuggestionFilter } from '@/lib/data/suggestions'

type SuggestionCounts = {
  pending: number
  approved: number
  rejected: number
  byType: {
    TASK: number
    PR: number
    REPLY: number
  }
}

type SuggestionsPanelProps = {
  initialSuggestions: SuggestionWithContext[]
  initialCounts: SuggestionCounts
  projects: Array<{ id: string; name: string }>
  currentFilter: SuggestionFilter
}

// Transform API suggestion to shared card format
function toSuggestionCardData(
  suggestion: SuggestionWithContext
): SuggestionCardData {
  const content = suggestion.suggestedContent as
    | TaskSuggestedContent
    | PRSuggestedContent

  const title = 'title' in content ? content.title : 'Untitled'
  const description =
    'description' in content
      ? (content.description ?? null)
      : 'body' in content
        ? (content.body ?? null)
        : null
  const priority = 'priority' in content ? (content.priority ?? null) : null
  const dueDate = 'dueDate' in content ? (content.dueDate ?? null) : null

  return {
    id: suggestion.id,
    type: suggestion.type as 'TASK' | 'PR' | 'REPLY',
    title,
    description,
    confidence: Number(suggestion.confidence),
    reasoning: suggestion.reasoning,
    priority,
    dueDate,
    // Client info derived from project
    client:
      suggestion.project?.clientId && suggestion.project?.clientName
        ? {
            id: suggestion.project.clientId,
            name: suggestion.project.clientName,
            slug: suggestion.project.clientSlug,
          }
        : null,
    project: suggestion.project
      ? {
          id: suggestion.projectId!,
          name: suggestion.project.name,
          slug: suggestion.project.slug,
          clientSlug: suggestion.project.clientSlug,
        }
      : null,
    emailContext: suggestion.message
      ? {
          threadId: suggestion.threadId,
          subject: suggestion.message.subject,
          fromEmail: suggestion.message.fromEmail,
          sentAt: suggestion.message.sentAt,
        }
      : null,
    createdTask: suggestion.createdTask
      ? { id: suggestion.createdTask.id }
      : null,
  }
}

export function SuggestionsPanel({
  initialSuggestions,
  initialCounts,
  projects: _projects, // Reserved for future project filter dropdown
  currentFilter,
}: SuggestionsPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [counts, setCounts] = useState(initialCounts)
  const [selected, setSelected] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState<string | null>(null)
  // Track status per suggestion for bulk operations (defaults to BACKLOG if not changed)
  const [suggestionStatuses, setSuggestionStatuses] = useState<Record<string, TaskStatus>>({})

  // Sync state when props change (e.g., on filter change via URL)
  useEffect(() => {
    setSuggestions(initialSuggestions)
    setSelected([]) // Clear selection on filter change
    setSuggestionStatuses({}) // Clear status selections on filter change
  }, [initialSuggestions])

  // Handle status change on individual card
  const handleStatusChange = useCallback((suggestionId: string, status: TaskStatus) => {
    setSuggestionStatuses(prev => ({ ...prev, [suggestionId]: status }))
  }, [])

  useEffect(() => {
    setCounts(initialCounts)
  }, [initialCounts])

  // Handle filter changes - URL-based like inbox panel
  const handleFilterChange = useCallback(
    (newFilter: SuggestionFilter) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newFilter === 'pending') {
        params.delete('filter')
      } else {
        params.set('filter', newFilter)
      }
      // Reset selection when changing filter
      setSelected([])
      const newUrl = params.toString()
        ? `/my/suggestions?${params.toString()}`
        : '/my/suggestions'
      router.push(newUrl)
    },
    [router, searchParams]
  )

  const handleQuickApprove = async (suggestionId: string, status: TaskStatus) => {
    setProcessing(true)
    setProcessingId(suggestionId)
    try {
      const response = await fetch(`/api/suggestions/${suggestionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve')
      }

      setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
      setCounts(prev => ({
        ...prev,
        pending: prev.pending - 1,
        approved: prev.approved + 1,
      }))
      toast({
        title: 'Suggestion approved',
        description: 'Task created successfully.',
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to approve suggestion',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
      setProcessingId(null)
    }
  }

  const handleReject = async (suggestionId: string) => {
    setProcessing(true)
    setProcessingId(suggestionId)
    try {
      const response = await fetch(`/api/suggestions/${suggestionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) throw new Error('Failed to reject')

      setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
      setCounts(prev => ({
        ...prev,
        pending: prev.pending - 1,
        rejected: prev.rejected + 1,
      }))
      toast({ title: 'Suggestion rejected' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to reject suggestion',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
      setProcessingId(null)
      setRejectDialogOpen(null)
    }
  }

  const handleUnreject = async (suggestionId: string) => {
    setProcessing(true)
    setProcessingId(suggestionId)
    try {
      const response = await fetch(`/api/suggestions/${suggestionId}/unreject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) throw new Error('Failed to restore')

      setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
      setCounts(prev => ({
        ...prev,
        pending: prev.pending + 1,
        rejected: prev.rejected - 1,
      }))
      toast({ title: 'Suggestion restored to pending' })
      router.refresh()
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to restore suggestion',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
      setProcessingId(null)
    }
  }

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selected.length === 0) return

    setProcessing(true)
    try {
      // Build per-suggestion status map for approvals
      // Use the card's selected status, defaulting to BACKLOG if not changed
      const statuses: Record<string, TaskStatus> = {}
      if (action === 'approve') {
        for (const id of selected) {
          statuses[id] = suggestionStatuses[id] ?? 'BACKLOG'
        }
      }

      const response = await fetch('/api/suggestions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          suggestionIds: selected,
          ...(action === 'approve' && { statuses }),
        }),
      })

      const result = await response.json()

      setSuggestions(prev => prev.filter(s => !selected.includes(s.id)))
      setCounts(prev => ({
        ...prev,
        pending: prev.pending - result.succeeded,
        [action === 'approve' ? 'approved' : 'rejected']:
          prev[action === 'approve' ? 'approved' : 'rejected'] +
          result.succeeded,
      }))
      setSelected([])
      // Clear status selections for processed suggestions
      setSuggestionStatuses(prev => {
        const next = { ...prev }
        for (const id of selected) {
          delete next[id]
        }
        return next
      })

      toast({
        title: result.failed > 0 ? 'Partial success' : 'Success',
        description: `${result.succeeded} suggestions ${action}d${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      })
      router.refresh()
    } catch {
      toast({
        title: 'Error',
        description: 'Bulk action failed',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    setSelected(prev =>
      prev.length === suggestions.length ? [] : suggestions.map(s => s.id)
    )
  }

  // Only show selection controls for pending filter
  const canSelect = currentFilter === 'pending'

  return (
    <>
      <AppShellHeader>
        <h1 className='text-2xl font-semibold tracking-tight'>Suggestions</h1>
        <p className='text-sm text-muted-foreground'>
          Review AI-generated suggestions from client communications.
        </p>
      </AppShellHeader>

      <div className='space-y-6'>
        {/* Filter Tabs - Above the main container */}
        <div className='flex flex-wrap items-center gap-2'>
          <FilterBadge
            icon={<Inbox className='h-3.5 w-3.5' />}
            label='Pending'
            count={counts.pending}
            isActive={currentFilter === 'pending'}
            onClick={() => handleFilterChange('pending')}
          />
          <FilterBadge
            icon={<CheckCircle2 className='h-3.5 w-3.5' />}
            label='Approved'
            count={counts.approved}
            isActive={currentFilter === 'approved'}
            colorClass='text-green-600 dark:text-green-400'
            onClick={() => handleFilterChange('approved')}
          />
          <FilterBadge
            icon={<XCircle className='h-3.5 w-3.5' />}
            label='Rejected'
            count={counts.rejected}
            isActive={currentFilter === 'rejected'}
            colorClass='text-red-600 dark:text-red-400'
            onClick={() => handleFilterChange('rejected')}
          />
        </div>

        {/* Main Container with Background */}
        <section className='rounded-xl border bg-background p-6 shadow-sm'>
          {/* Bulk Actions Toolbar */}
          {canSelect && (
            <div className='mb-6 flex items-center justify-between'>
              {/* Left: Selection control */}
              <label className='flex cursor-pointer items-center gap-2'>
                <Checkbox
                  checked={
                    suggestions.length > 0 &&
                    selected.length === suggestions.length
                  }
                  onCheckedChange={toggleSelectAll}
                  disabled={suggestions.length === 0}
                />
                <span className='text-sm'>Select all</span>
              </label>

              {/* Right: Selection count + Actions */}
              <div className='flex items-center gap-3'>
                {/* Selection count */}
                <span className='text-sm tabular-nums text-muted-foreground'>
                  {selected.length} selected
                </span>

                {/* Action buttons */}
                <div className='flex items-center gap-1.5'>
                  <Button
                    size='sm'
                    onClick={() => handleBulkAction('approve')}
                    disabled={processing || selected.length === 0}
                  >
                    <Check className='mr-1 h-4 w-4' />
                    Approve
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => handleBulkAction('reject')}
                    disabled={processing || selected.length === 0}
                  >
                    <X className='mr-1 h-4 w-4' />
                    Reject
                  </Button>
                </div>

                {/* Clear - separate from primary actions */}
                {selected.length > 0 && (
                  <Button
                    size='sm'
                    variant='ghost'
                    className='text-muted-foreground'
                    onClick={() => setSelected([])}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className='space-y-4'>
            {/* Suggestion List */}
            {suggestions.length === 0 ? (
              <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center'>
                <Sparkles className='h-8 w-8 text-muted-foreground' />
                <p className='mt-2 text-sm text-muted-foreground'>
                  {currentFilter === 'pending'
                    ? 'No pending suggestions. Suggestions are generated when emails are analyzed on project boards.'
                    : currentFilter === 'approved'
                      ? 'No approved suggestions yet.'
                      : 'No rejected suggestions yet.'}
                </p>
              </div>
            ) : (
              <div className='space-y-3'>
                {suggestions.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={toSuggestionCardData(suggestion)}
                    isCreating={processingId === suggestion.id}
                    onCreateTask={status => handleQuickApprove(suggestion.id, status)}
                    onReject={() => setRejectDialogOpen(suggestion.id)}
                    onUnreject={() => handleUnreject(suggestion.id)}
                    showProjectLink
                    showCheckbox={canSelect}
                    selected={selected.includes(suggestion.id)}
                    onSelect={() => toggleSelect(suggestion.id)}
                    disabled={processing}
                    showActions={currentFilter === 'pending'}
                    showUnreject={currentFilter === 'rejected'}
                    initialStatus={suggestionStatuses[suggestion.id]}
                    onStatusChange={status => handleStatusChange(suggestion.id, status)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Reject Dialog */}
      <ConfirmDialog
        open={!!rejectDialogOpen}
        title='Reject suggestion?'
        description='This will reject the suggestion. This action cannot be undone.'
        confirmLabel='Reject'
        cancelLabel='Cancel'
        confirmVariant='destructive'
        onConfirm={() => rejectDialogOpen && handleReject(rejectDialogOpen)}
        onCancel={() => setRejectDialogOpen(null)}
      />
    </>
  )
}

// Filter badge component for clickable status filters
function FilterBadge({
  icon,
  label,
  count,
  isActive,
  colorClass,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  isActive: boolean
  colorClass?: string
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
        isActive
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted',
        colorClass && !isActive && colorClass
      )}
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          'ml-1 rounded-full px-1.5 py-0.5 text-xs',
          isActive
            ? 'bg-primary/20 text-primary'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {count}
      </span>
    </button>
  )
}
