'use client'

import { formatDistanceToNow } from 'date-fns'
import { Building2, FolderKanban } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ThreadSummary } from '@/lib/types/messages'

type ThreadRowProps = {
  thread: ThreadSummary
  isSelected: boolean
  isFirst: boolean
  onClick: () => void
}

export function ThreadRow({
  thread,
  isSelected,
  isFirst,
  onClick,
}: ThreadRowProps) {
  const latestMessage = thread.latestMessage
  const isUnread = latestMessage && !latestMessage.isRead

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'bg-muted/20 flex w-full cursor-pointer items-center gap-3 p-2.5 text-left transition-colors',
        'hover:bg-muted/60',
        isUnread &&
          'bg-blue-50/50 hover:bg-blue-100/50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40',
        isSelected && 'bg-muted ring-border ring-1 ring-inset',
        !isFirst && 'border-border/50 border-t'
      )}
    >
      {/* Unread indicator */}
      <div className='w-2 flex-shrink-0'>
        {isUnread && <div className='h-2 w-2 rounded-full bg-blue-500' />}
      </div>

      {/* Center: Sender, count, timestamp / Subject */}
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <span
            className={cn(
              'truncate text-sm',
              isUnread ? 'font-semibold' : 'font-medium'
            )}
          >
            {latestMessage?.fromName || latestMessage?.fromEmail || 'Unknown'}
          </span>
          {thread.messageCount > 1 && (
            <span className='flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 px-1.5 text-xs font-medium text-neutral-700 tabular-nums dark:bg-neutral-700 dark:text-neutral-200'>
              {thread.messageCount}
            </span>
          )}
          <span className='text-muted-foreground/70 flex-shrink-0 text-xs whitespace-nowrap tabular-nums'>
            {thread.lastMessageAt
              ? formatDistanceToNow(new Date(thread.lastMessageAt), {
                  addSuffix: true,
                })
              : ''}
          </span>
        </div>
        <div
          className={cn(
            'truncate text-sm',
            isUnread ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {thread.subject || '(no subject)'}
        </div>
      </div>

      {/* Right: Client badge */}
      {thread.client && (
        <Badge
          variant='default'
          className='flex-shrink-0 border-0 bg-blue-100 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300'
        >
          <Building2 className='mr-1 h-3 w-3' />
          <span className='max-w-[100px] truncate'>{thread.client.name}</span>
        </Badge>
      )}

      {/* Far right: Project badge */}
      {thread.project && (
        <Badge
          variant='default'
          className='flex-shrink-0 border-0 bg-green-100 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/50 dark:text-green-300'
        >
          <FolderKanban className='mr-1 h-3 w-3' />
          <span className='max-w-[100px] truncate'>{thread.project.name}</span>
        </Badge>
      )}
    </button>
  )
}
