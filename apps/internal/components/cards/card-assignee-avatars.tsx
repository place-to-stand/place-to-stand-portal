'use client'

import { User } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { cn } from '@/lib/utils'
import { PersonAvatar } from '@/components/ui/user-avatar'

export type CardAssignee = {
  id: string
  name: string
  avatarUrl: string | null
}

/**
 * The bottom-right assignee on the board cards: one avatar, name in the
 * tooltip. A task has one assignee; should older data still list several,
 * the first is shown.
 */
export function CardAssigneeAvatars({
  assignees,
  className,
}: {
  assignees: CardAssignee[]
  className?: string
}) {
  if (assignees.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'text-muted-foreground inline-flex h-5 w-5 shrink-0 items-center justify-center',
              className
            )}
            aria-label='Unassigned'
          >
            <User className='h-3.5 w-3.5' aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent side='top'>Unassigned</TooltipContent>
      </Tooltip>
    )
  }

  const [assignee] = assignees
  return (
    <span className={cn('flex shrink-0 items-center', className)}>
      <PersonAvatar
        size='xs'
        userId={assignee.id}
        name={assignee.name}
        ariaLabel={`Assigned to ${assignee.name}`}
        hasPhoto={Boolean(assignee.avatarUrl)}
      />
    </span>
  )
}
