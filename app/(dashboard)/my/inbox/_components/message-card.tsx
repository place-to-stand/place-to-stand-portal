'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Reply, ReplyAll, Forward } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Message } from '@/lib/types/messages'
import { sanitizeEmailHtml, type CidMapping } from '@/lib/email/sanitize'

import { EmailIframe } from './email-iframe'

type MessageCardProps = {
  message: Message
  cidMappings?: CidMapping[]
  onReply?: (mode: 'reply' | 'reply_all' | 'forward') => void
}

export function MessageCard({ message, cidMappings, onReply }: MessageCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const sanitizedHtml = useMemo(() => {
    if (!message.bodyHtml) return null
    return sanitizeEmailHtml(message.bodyHtml, {
      externalMessageId: message.externalMessageId,
      cidMappings,
    })
  }, [message.bodyHtml, message.externalMessageId, cidMappings])

  return (
    <div className='bg-card rounded-lg border'>
      {/* Header */}
      <button
        type='button'
        onClick={() => setIsExpanded(!isExpanded)}
        className='hover:bg-muted/50 flex w-full items-start justify-between p-4 text-left'
      >
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='font-medium'>
              {message.fromName || message.fromEmail}
            </span>
            {message.isInbound ? (
              <Badge variant='secondary' className='text-xs'>
                Received
              </Badge>
            ) : (
              <Badge variant='outline' className='text-xs'>
                Sent
              </Badge>
            )}
          </div>
          {message.fromName && message.fromEmail && (
            <div className='text-muted-foreground mt-0.5 text-xs'>
              {message.fromEmail}
            </div>
          )}
          <div className='text-muted-foreground mt-1 text-sm'>
            To: {message.toEmails?.join(', ') || 'Unknown'}
          </div>
        </div>
        <div className='text-muted-foreground text-xs'>
          {format(new Date(message.sentAt), 'MMM d, yyyy h:mm a')}
        </div>
      </button>

      {/* Snippet preview when collapsed */}
      {!isExpanded && message.snippet && (
        <div className='text-muted-foreground border-t px-4 py-2 text-sm'>
          {message.snippet}
        </div>
      )}

      {/* Body - Using iframe for style isolation */}
      {isExpanded && (
        <>
          <Separator />
          <div className='p-4'>
            {sanitizedHtml ? (
              <EmailIframe html={sanitizedHtml} />
            ) : message.bodyText ? (
              <pre className='text-sm whitespace-pre-wrap'>
                {message.bodyText}
              </pre>
            ) : message.snippet ? (
              <p className='text-muted-foreground text-sm'>{message.snippet}</p>
            ) : (
              <p className='text-muted-foreground text-sm italic'>No content</p>
            )}
          </div>

          {/* Reply Actions */}
          {onReply && (
            <>
              <Separator />
              <div className='flex items-center gap-2 p-3'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => onReply('reply')}
                >
                  <Reply className='mr-2 h-4 w-4' />
                  Reply
                </Button>
                {((message.toEmails?.length ?? 0) > 1 || (message.ccEmails?.length ?? 0) > 0) && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => onReply('reply_all')}
                  >
                    <ReplyAll className='mr-2 h-4 w-4' />
                    Reply All
                  </Button>
                )}
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => onReply('forward')}
                >
                  <Forward className='mr-2 h-4 w-4' />
                  Forward
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// Re-export CidMapping type for convenience
export type { CidMapping }
