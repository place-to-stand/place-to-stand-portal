'use client'

import { Mic, Check, X, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SuggestionForLead } from '@/lib/queries/suggestions'
import type { LinkTranscriptSuggestedContent } from '@/lib/types/suggestions'

type LeadTranscriptSuggestionsSectionProps = {
  leadId: string
  isAdmin: boolean
}

async function fetchLeadSuggestions(leadId: string): Promise<SuggestionForLead[]> {
  const res = await fetch(`/api/leads/${leadId}/suggestions?includeResolved=true`)
  const data = await res.json()
  return data.ok ? data.suggestions ?? [] : []
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

export function LeadTranscriptSuggestionsSection({
  leadId,
  isAdmin,
}: LeadTranscriptSuggestionsSectionProps) {
  const queryClient = useQueryClient()

  const { data: allSuggestions = [], isLoading } = useQuery({
    queryKey: ['lead-suggestions', leadId, 'all'],
    queryFn: () => fetchLeadSuggestions(leadId),
    enabled: isAdmin,
  })

  const transcriptSuggestions = allSuggestions.filter(s => {
    const content = s.suggestedContent as { actionType?: string }
    return content.actionType === 'LINK_TRANSCRIPT'
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

  if (!isAdmin || (!isLoading && transcriptSuggestions.length === 0)) return null

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <Mic className='text-muted-foreground h-4 w-4' />
        <span className='text-sm font-medium'>Transcripts</span>
        {transcriptSuggestions.length > 0 && (
          <Badge variant='secondary' className='text-xs'>
            {transcriptSuggestions.length}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className='flex items-center gap-2 rounded-lg border bg-muted/30 p-3'>
          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
          <span className='text-muted-foreground text-sm'>Loading...</span>
        </div>
      ) : (
        <div className='space-y-2'>
          {transcriptSuggestions.map(suggestion => {
            const content = suggestion.suggestedContent as LinkTranscriptSuggestedContent
            const isPending = ['PENDING', 'DRAFT', 'MODIFIED'].includes(suggestion.status)
            const isApproved = suggestion.status === 'APPROVED'
            const isRejected = suggestion.status === 'REJECTED'

            return (
              <div
                key={suggestion.id}
                className={`space-y-1.5 rounded-lg border p-3 ${
                  isApproved
                    ? 'border-green-500/20 bg-green-500/5'
                    : isRejected
                      ? 'border-muted bg-muted/20 opacity-60'
                      : 'bg-muted/30'
                }`}
              >
                <div className='flex items-start justify-between gap-2'>
                  <span className='text-sm font-medium truncate'>
                    {content.title}
                  </span>
                  {isApproved && (
                    <Badge variant='outline' className='shrink-0 text-[10px] bg-green-500/10 text-green-600 border-green-500/20'>
                      Linked
                    </Badge>
                  )}
                  {isRejected && (
                    <Badge variant='outline' className='shrink-0 text-[10px]'>
                      Excluded
                    </Badge>
                  )}
                </div>

                {content.date && (
                  <div className='text-xs text-muted-foreground'>
                    {format(new Date(content.date), 'MMM d, yyyy')}
                  </div>
                )}

                {content.snippetPreview && (
                  <p className='text-xs text-muted-foreground line-clamp-2'>
                    {content.snippetPreview}
                  </p>
                )}

                {isPending && (
                  <div className='flex items-center justify-end gap-1 pt-1'>
                    <Button
                      type='button'
                      size='icon-sm'
                      variant='ghost'
                      className='h-7 w-7 text-green-600 hover:bg-green-500/10 hover:text-green-600'
                      onClick={() => approveMutation.mutate(suggestion.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      title='Include in AI context'
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
                      title='Exclude from AI context'
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
