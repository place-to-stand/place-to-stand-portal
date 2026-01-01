'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Sparkles,
  Mail,
  Calendar,
  FolderKanban,
  Loader2,
  Check,
  X,
  ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
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

// Consistent confidence colors matching the email viewer AI suggestions
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8)
    return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
  if (confidence >= 0.6)
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
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
  const [rejectDialogOpen, setRejectDialogOpen] = useState<string | null>(null)

  // Sync state when props change (e.g., on filter change via URL)
  useEffect(() => {
    setSuggestions(initialSuggestions)
    setSelected([]) // Clear selection on filter change
  }, [initialSuggestions])

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

  const handleQuickApprove = async (suggestionId: string) => {
    setProcessing(true)
    try {
      const response = await fetch(`/api/suggestions/${suggestionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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
    }
  }

  const handleReject = async (suggestionId: string) => {
    setProcessing(true)
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
      setRejectDialogOpen(null)
    }
  }

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selected.length === 0) return

    setProcessing(true)
    try {
      const response = await fetch('/api/suggestions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, suggestionIds: selected }),
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
        <p className='text-muted-foreground text-sm'>
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
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
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

              {/* Right: Status + Actions */}
              <div className='flex items-center gap-3'>
                {/* Selection count */}
                <span className='text-muted-foreground text-sm tabular-nums'>
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
                <Sparkles className='text-muted-foreground h-8 w-8' />
                <p className='text-muted-foreground mt-2 text-sm'>
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
                    suggestion={suggestion}
                    selected={selected.includes(suggestion.id)}
                    onSelect={() => toggleSelect(suggestion.id)}
                    onQuickApprove={() => handleQuickApprove(suggestion.id)}
                    onReject={() => setRejectDialogOpen(suggestion.id)}
                    disabled={processing}
                    showActions={currentFilter === 'pending'}
                    showCheckbox={canSelect}
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

// Redesigned suggestion card matching email viewer AI suggestions style
function SuggestionCard({
  suggestion,
  selected,
  onSelect,
  onQuickApprove,
  onReject,
  disabled,
  showActions,
  showCheckbox,
}: {
  suggestion: SuggestionWithContext
  selected: boolean
  onSelect: () => void
  onQuickApprove: () => void
  onReject: () => void
  disabled?: boolean
  showActions: boolean
  showCheckbox: boolean
}) {
  const content = suggestion.suggestedContent as
    | TaskSuggestedContent
    | PRSuggestedContent
  const title = 'title' in content ? content.title : 'Untitled'
  const description =
    'description' in content
      ? content.description
      : 'body' in content
        ? content.body
        : null

  const confidencePercent = Math.round(Number(suggestion.confidence) * 100)

  return (
    <div
      className={cn(
        'bg-muted/30 rounded-lg border p-4 transition-all',
        selected && 'ring-primary ring-2'
      )}
    >
      <div className='flex items-start gap-3'>
        {showCheckbox && (
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            className='mt-0.5'
          />
        )}
        <div className='min-w-0 flex-1'>
          {/* Header: Type badge + Title + Confidence */}
          <div className='flex items-start justify-between gap-2'>
            <div className='flex items-center gap-2'>
              <Badge variant='outline' className='text-xs'>
                {suggestion.type}
              </Badge>
              <h4 className='text-sm font-medium'>{title}</h4>
            </div>
            <Badge
              variant='secondary'
              className={cn(
                'shrink-0',
                getConfidenceColor(Number(suggestion.confidence))
              )}
            >
              {confidencePercent}% confidence
            </Badge>
          </div>

          {/* Email context */}
          {suggestion.message && (
            <div className='text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-xs'>
              {suggestion.threadId ? (
                <Link
                  href={`/my/inbox?thread=${suggestion.threadId}`}
                  className='hover:text-foreground flex items-center gap-1 hover:underline'
                >
                  <Mail className='h-3 w-3' />
                  {suggestion.message.subject || '(no subject)'}
                </Link>
              ) : (
                <span className='flex items-center gap-1'>
                  <Mail className='h-3 w-3' />
                  {suggestion.message.subject || '(no subject)'}
                </span>
              )}
              <span className='text-muted-foreground/50'>·</span>
              <span>{suggestion.message.fromEmail}</span>
              {suggestion.message.sentAt && (
                <>
                  <span className='text-muted-foreground/50'>·</span>
                  <span>
                    {formatDistanceToNow(new Date(suggestion.message.sentAt))}{' '}
                    ago
                  </span>
                </>
              )}
            </div>
          )}

          {/* Description preview */}
          {description && (
            <p className='text-muted-foreground mt-2 line-clamp-2 text-sm'>
              {description}
            </p>
          )}

          {/* Reasoning quote */}
          {suggestion.reasoning && (
            <p className='text-muted-foreground/80 mt-2 text-xs italic'>
              &ldquo;{suggestion.reasoning}&rdquo;
            </p>
          )}

          {/* Metadata badges */}
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            {suggestion.project &&
              (suggestion.project.slug && suggestion.project.clientSlug ? (
                <Link
                  href={`/projects/${suggestion.project.clientSlug}/${suggestion.project.slug}/board`}
                >
                  <Badge
                    variant='outline'
                    className='hover:bg-muted cursor-pointer text-xs'
                  >
                    <FolderKanban className='mr-1 h-3 w-3' />
                    {suggestion.project.name}
                  </Badge>
                </Link>
              ) : (
                <Badge variant='outline' className='text-xs'>
                  <FolderKanban className='mr-1 h-3 w-3' />
                  {suggestion.project.name}
                </Badge>
              ))}
            {'dueDate' in content && content.dueDate && (
              <Badge variant='outline' className='text-xs'>
                <Calendar className='mr-1 h-3 w-3' />
                {content.dueDate}
              </Badge>
            )}
            {'priority' in content && content.priority && (
              <Badge
                variant='outline'
                className={cn(
                  'text-xs',
                  content.priority === 'HIGH'
                    ? 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400'
                    : content.priority === 'MEDIUM'
                      ? 'border-amber-300 text-amber-600 dark:border-amber-800 dark:text-amber-400'
                      : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                )}
              >
                {content.priority}
              </Badge>
            )}
          </div>

          {/* Actions - matching email viewer suggestion style */}
          {showActions && (
            <div className='mt-3 flex items-center gap-2 border-t pt-3'>
              <Button
                size='sm'
                onClick={onQuickApprove}
                disabled={disabled || !suggestion.projectId}
              >
                {disabled ? (
                  <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                ) : (
                  <Check className='mr-1 h-4 w-4' />
                )}
                {suggestion.type === 'TASK' ? 'Create Task' : 'Create PR'}
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={onReject}
                disabled={disabled}
                className='text-muted-foreground hover:text-destructive'
              >
                <X className='mr-1 h-4 w-4' />
                Dismiss
              </Button>
            </div>
          )}

          {/* Task link for approved suggestions */}
          {suggestion.createdTask &&
            suggestion.project?.clientSlug &&
            suggestion.project?.slug && (
              <div className='mt-3 border-t pt-3'>
                <Link
                  href={`/projects/${suggestion.project.clientSlug}/${suggestion.project.slug}/board/${suggestion.createdTask.id}`}
                  className='text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline'
                >
                  <ExternalLink className='h-3.5 w-3.5' />
                  View created task
                </Link>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
