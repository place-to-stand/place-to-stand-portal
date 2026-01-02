'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Mail, MailOpen, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

type EmailToolbarProps = {
  threadId: string
  isRead: boolean
  canGoPrev: boolean
  canGoNext: boolean
  onToggleReadStatus: (isRead: boolean) => void
  onPrev: () => void
  onNext: () => void
}

export function EmailToolbar({
  threadId,
  isRead,
  canGoPrev,
  canGoNext,
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
      {/* Read/Unread Toggle */}
      <Button
        variant='ghost'
        size='icon'
        onClick={handleToggleRead}
        disabled={isTogglingRead}
        className='h-8 w-8'
      >
        {isTogglingRead ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : isRead ? (
          <Mail className='h-4 w-4' />
        ) : (
          <MailOpen className='h-4 w-4' />
        )}
      </Button>

      {/* Separator */}
      <div className='mx-1 h-5 w-px bg-border' />

      {/* Previous Thread */}
      <Button
        variant='ghost'
        size='icon'
        onClick={onPrev}
        disabled={!canGoPrev}
        className='h-8 w-8'
      >
        <ArrowLeft className='h-4 w-4' />
      </Button>

      {/* Next Thread */}
      <Button
        variant='ghost'
        size='icon'
        onClick={onNext}
        disabled={!canGoNext}
        className='h-8 w-8'
      >
        <ArrowRight className='h-4 w-4' />
      </Button>
    </div>
  )
}
