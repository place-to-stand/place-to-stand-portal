'use client'

import {
  Sparkles,
  Loader2,
  ListTodo,
  MessageSquare,
  Phone,
  FileText,
  ArrowRight,
  RefreshCw,
  Check,
  X,
  Mail,
  Mic,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SuggestionForLead } from '@/lib/queries/suggestions'
import type { LeadActionType } from '@/lib/types/suggestions'

type LeadSuggestionsPanelProps = {
  leadId: string
  isAdmin: boolean
  /** Called when a SCHEDULE_CALL suggestion is approved */
  onScheduleCall?: (initialTitle?: string) => void
  /** Called when a SEND_PROPOSAL suggestion is approved */
  onSendProposal?: () => void
}

async function fetchLeadSuggestions(leadId: string): Promise<SuggestionForLead[]> {
  const res = await fetch(`/api/leads/${leadId}/suggestions`)
  const data = await res.json()
  if (data.ok) {
    return data.suggestions || []
  }
  return []
}

async function approveSuggestion(suggestionId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/suggestions/${suggestionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return res.json()
}

async function rejectSuggestion(suggestionId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/suggestions/${suggestionId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return res.json()
}

async function generateSuggestions(leadId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/leads/${leadId}/suggestions/generate`, {
    method: 'POST',
  })
  return res.json()
}

const ACTION_ICONS: Record<LeadActionType, typeof ListTodo> = {
  FOLLOW_UP: ListTodo,
  REPLY: MessageSquare,
  SCHEDULE_CALL: Phone,
  SEND_PROPOSAL: FileText,
  ADVANCE_STATUS: ArrowRight,
  LINK_EMAIL_THREAD: Mail,
  LINK_TRANSCRIPT: Mic,
}

const ACTION_COLORS: Record<LeadActionType, string> = {
  FOLLOW_UP: 'text-blue-500',
  REPLY: 'text-violet-500',
  SCHEDULE_CALL: 'text-green-500',
  SEND_PROPOSAL: 'text-amber-500',
  ADVANCE_STATUS: 'text-cyan-500',
  LINK_EMAIL_THREAD: 'text-sky-500',
  LINK_TRANSCRIPT: 'text-rose-500',
}

const PRIORITY_BADGES: Record<string, { className: string; label: string }> = {
  high: { className: 'bg-red-500/10 text-red-600 border-red-500/20', label: 'High' },
  medium: { className: 'bg-amber-500/10 text-amber-600 border-amber-500/20', label: 'Medium' },
  low: { className: 'bg-gray-500/10 text-gray-600 border-gray-500/20', label: 'Low' },
}

export function LeadSuggestionsPanel({
  leadId,
  isAdmin,
  onScheduleCall,
  onSendProposal,
}: LeadSuggestionsPanelProps) {
  const queryClient = useQueryClient()

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['lead-suggestions', leadId],
    queryFn: () => fetchLeadSuggestions(leadId),
    enabled: isAdmin,
  })

  const approveMutation = useMutation({
    mutationFn: approveSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-suggestions', leadId] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: rejectSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-suggestions', leadId] })
    },
  })

  const generateMutation = useMutation({
    mutationFn: () => generateSuggestions(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-suggestions', leadId] })
    },
  })

  if (!isAdmin) return null

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Sparkles className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Suggested Actions</span>
        </div>
        <Button
          type='button'
          variant='outline'
          size='icon-sm'
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || isLoading}
          title='Generate new suggestions'
        >
          <RefreshCw
            className={`text-muted-foreground h-3.5 w-3.5 ${generateMutation.isPending ? 'animate-spin' : ''}`}
          />
        </Button>
      </div>

      {generateMutation.isPending ? (
        <div className='bg-muted/30 flex items-center gap-2 rounded-lg border p-3'>
          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
          <span className='text-muted-foreground text-sm'>
            Generating suggestions...
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
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm'>
            No suggestions yet.
          </p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className='w-full'
          >
            <Sparkles className='mr-2 h-4 w-4' />
            Generate Suggestions
          </Button>
        </div>
      ) : (
        <div className='space-y-2'>
          {suggestions.map(suggestion => {
            const content = suggestion.suggestedContent as {
              actionType?: LeadActionType
              title?: string
              reasoning?: string
            }
            const actionType = content.actionType || 'FOLLOW_UP'
            const Icon = ACTION_ICONS[actionType] || ListTodo
            const iconColor = ACTION_COLORS[actionType] || 'text-muted-foreground'
            const priorityBadge = PRIORITY_BADGES[
              (content as { priority?: string }).priority || 'medium'
            ] || PRIORITY_BADGES.medium

            const isPending = ['PENDING', 'DRAFT', 'MODIFIED'].includes(suggestion.status)

            return (
              <div
                key={suggestion.id}
                className='bg-muted/30 space-y-2 rounded-lg border p-3'
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex min-w-0 items-center gap-2'>
                    <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
                    <span className='truncate text-sm font-medium'>
                      {suggestion.title || content.title || 'Untitled'}
                    </span>
                  </div>
                  <Badge variant='secondary' className='shrink-0 text-xs'>
                    {Math.round(parseFloat(suggestion.confidence) * 100)}%
                  </Badge>
                </div>

                {suggestion.reasoning && (
                  <p className='text-muted-foreground text-xs line-clamp-2'>
                    {suggestion.reasoning}
                  </p>
                )}

                <div className='flex items-center justify-between gap-2 pt-1'>
                  <Badge
                    variant='outline'
                    className={`text-xs ${priorityBadge.className}`}
                  >
                    {priorityBadge.label}
                  </Badge>

                  {isPending && (
                    <div className='flex items-center gap-1'>
                      <Button
                        type='button'
                        size='icon-sm'
                        variant='ghost'
                        className='h-7 w-7 text-green-600 hover:bg-green-500/10 hover:text-green-600'
                        onClick={() => {
                          approveMutation.mutate(suggestion.id)
                          // Open dialog for actionable suggestions
                          if (actionType === 'SCHEDULE_CALL' && onScheduleCall) {
                            onScheduleCall(content.title)
                          } else if (actionType === 'SEND_PROPOSAL' && onSendProposal) {
                            onSendProposal()
                          }
                        }}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        title='Approve'
                      >
                        <Check className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        size='icon-sm'
                        variant='ghost'
                        className='h-7 w-7 text-red-600 hover:bg-red-500/10 hover:text-red-600'
                        onClick={() => rejectMutation.mutate(suggestion.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        title='Dismiss'
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
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
