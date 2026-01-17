'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  MailOpen,
  Loader2,
  Reply,
  ReplyAll,
  Forward,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type EmailToolbarProps = {
  threadId: string
  isRead: boolean
  canGoPrev: boolean
  canGoNext: boolean
  showReplyAll: boolean
  onToggleReadStatus: (isRead: boolean) => void
  onPrev: () => void
  onNext: () => void
  onReply: (mode: 'reply' | 'reply_all' | 'forward') => void
}

export function EmailToolbar({
  threadId,
  isRead,
  canGoPrev,
  canGoNext,
  showReplyAll,
  onToggleReadStatus,
  onPrev,
  onNext,
  onReply,
}: EmailToolbarProps) {
  const [isTogglingRead, setIsTogglingRead] = useState(false)

  const handleToggleRead = async () => {
    setIsTogglingRead(true)
    try {
      const endpoint = isRead
        ? `/api/threads/${threadId}/unread`
        : `/api/threads/${threadId}/read`

      const res = await fetch(endpoint, { method: 'POST' })
      if (res.ok) {
        onToggleReadStatus(!isRead)
      }
    } catch (err) {
      console.error('Failed to toggle read status:', err)
    } finally {
      setIsTogglingRead(false)
    }
  }

  return (
    <div className='flex items-center gap-1 rounded-lg border bg-muted/30 p-1'>
      {/* Reply Actions */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='outline'
            size='icon-sm'
            onClick={() => onReply('reply')}
          >
            <Reply className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reply</TooltipContent>
      </Tooltip>

      {showReplyAll && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon-sm'
              onClick={() => onReply('reply_all')}
            >
              <ReplyAll className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reply All</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='outline'
            size='icon-sm'
            onClick={() => onReply('forward')}
          >
            <Forward className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Forward</TooltipContent>
      </Tooltip>

      {/* Separator */}
      <div className='mx-1 h-5 w-px bg-border' />

      {/* Read/Unread Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='outline'
            size='icon-sm'
            onClick={handleToggleRead}
            disabled={isTogglingRead}
          >
            {isTogglingRead ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : isRead ? (
              <Mail className='h-4 w-4' />
            ) : (
              <MailOpen className='h-4 w-4' />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isRead ? 'Mark as unread' : 'Mark as read'}</TooltipContent>
      </Tooltip>

      {/* Separator */}
      <div className='mx-1 h-5 w-px bg-border' />

      {/* Previous Thread */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={onPrev}
            disabled={!canGoPrev}
          >
            <ArrowLeft className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous</TooltipContent>
      </Tooltip>

      {/* Next Thread */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={onNext}
            disabled={!canGoNext}
          >
            <ArrowRight className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next</TooltipContent>
      </Tooltip>
    </div>
  )
}
