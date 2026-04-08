'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Mail,
  MailOpen,
  Loader2,
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
  isLoadingMessages: boolean
  canGoPrev: boolean
  canGoNext: boolean
  gmailUrl: string | null
  onToggleReadStatus: (isRead: boolean) => void
  onPrev: () => void
  onNext: () => void
}

export function EmailToolbar({
  threadId,
  isRead,
  isLoadingMessages,
  canGoPrev,
  canGoNext,
  gmailUrl,
  onToggleReadStatus,
  onPrev,
  onNext,
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

      {/* Separator */}
      <div className='mx-1 h-5 w-px bg-border' />

      {/* Read/Unread Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={handleToggleRead}
            disabled={isTogglingRead || isLoadingMessages}
          >
            {isTogglingRead || isLoadingMessages ? (
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

      {/* Open Email in Gmail */}
      {gmailUrl && (
        <Button
          asChild
          variant='ghost'
          size='sm'
          className='h-7 gap-1.5 px-2'
        >
          <a
            href={gmailUrl}
            target='_blank'
            rel='noopener noreferrer'
          >
            <ExternalLink className='h-3.5 w-3.5' />
            Open in Gmail
          </a>
        </Button>
      )}
    </div>
  )
}
