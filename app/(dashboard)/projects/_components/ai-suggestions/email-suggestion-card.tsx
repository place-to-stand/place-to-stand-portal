'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

import type {
  EmailWithSuggestions,
  SuggestionFilterType,
} from '@/lib/projects/board/state/use-ai-suggestions-sheet'
import {
  SuggestionCard,
  type TaskStatus,
} from '@/components/suggestions/suggestion-card'

type EmailSuggestionCardProps = {
  email: EmailWithSuggestions
  isCreatingTask: string | null
  onCreateTask: (suggestionId: string, status: TaskStatus) => void
  onReject: (suggestionId: string, reason?: string) => void
  onUnreject: (suggestionId: string) => void
  filter: SuggestionFilterType
}

export function EmailSuggestionCard({
  email,
  isCreatingTask,
  onCreateTask,
  onReject,
  onUnreject,
  filter,
}: EmailSuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Filter suggestions based on current filter
  const filteredSuggestions = email.suggestions.filter(s => {
    switch (filter) {
      case 'pending':
        return s.status === 'PENDING' || s.status === 'DRAFT'
      case 'approved':
        return s.status === 'APPROVED' || s.status === 'MODIFIED'
      case 'rejected':
        return s.status === 'REJECTED'
      default:
        return false
    }
  })
  const hasSuggestions = filteredSuggestions.length > 0

  const receivedAgo = email.receivedAt
    ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
    : null

  const emailTitle = email.subject || '(no subject)'
  const threadUrl = email.threadId ? `/my/inbox?thread=${email.threadId}` : null

  return (
    <Card className='py-0'>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className='hover:bg-muted/50 cursor-pointer grid-rows-1 px-4 py-3'>
            <div className='flex items-start justify-between gap-3'>
              <div className='flex min-w-0 flex-1 items-start gap-3'>
                <div className='text-muted-foreground bg-muted mt-0.5 shrink-0 rounded-full p-2'>
                  <Mail className='h-4 w-4' />
                </div>
                <div className='min-w-0 flex-1'>
                  {threadUrl ? (
                    <Link
                      href={threadUrl}
                      onClick={e => e.stopPropagation()}
                      className='hover:text-primary truncate text-sm font-medium hover:underline'
                    >
                      {emailTitle}
                    </Link>
                  ) : (
                    <p className='truncate text-sm font-medium'>{emailTitle}</p>
                  )}
                  {receivedAgo && (
                    <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                      <span>{receivedAgo}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className='flex shrink-0 items-center gap-2'>
                {hasSuggestions && (
                  <span className='rounded-full bg-fuchsia-100 px-2 py-0.5 text-xs font-medium text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400'>
                    {filteredSuggestions.length} suggestion
                    {filteredSuggestions.length !== 1 ? 's' : ''}
                  </span>
                )}
                <Button variant='ghost' size='icon' className='h-6 w-6'>
                  {isExpanded ? (
                    <ChevronUp className='h-4 w-4' />
                  ) : (
                    <ChevronDown className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className='border-t px-4 pt-4 pb-4'>
            {hasSuggestions ? (
              <div className='space-y-3'>
                {filteredSuggestions.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={{
                      id: suggestion.id,
                      type: 'TASK',
                      title: suggestion.suggestedTitle,
                      description: suggestion.suggestedDescription,
                      confidence: parseFloat(suggestion.confidence),
                      reasoning: suggestion.reasoning,
                      priority: suggestion.suggestedPriority,
                      dueDate: suggestion.suggestedDueDate,
                    }}
                    isCreating={isCreatingTask === suggestion.id}
                    onCreateTask={status => onCreateTask(suggestion.id, status)}
                    onReject={reason => onReject(suggestion.id, reason)}
                    onUnreject={() => onUnreject(suggestion.id)}
                    showActions={filter === 'pending'}
                    showUnreject={filter === 'rejected'}
                  />
                ))}
              </div>
            ) : (
              <p className='text-muted-foreground text-center text-sm'>
                No {filter} suggestions for this email
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
