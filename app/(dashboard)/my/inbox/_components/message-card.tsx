'use client'

import { useState, useMemo } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Reply, ReplyAll, Forward, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Message } from '@/lib/types/messages'
import { sanitizeEmailHtml, type CidMapping } from '@/lib/email/sanitize'
import { cn } from '@/lib/utils'

import { AttachmentList, type AttachmentMetadata } from './attachment-viewer'
import { EmailIframe } from './email-iframe'

/** Three-dot ellipsis icon component */
function ThreeDots({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='currentColor'
      className={className}
    >
      <circle cx='5' cy='12' r='2' />
      <circle cx='12' cy='12' r='2' />
      <circle cx='19' cy='12' r='2' />
    </svg>
  )
}

type MessageCardProps = {
  message: Message
  cidMappings?: CidMapping[]
  attachments?: AttachmentMetadata[]
  onReply?: (mode: 'reply' | 'reply_all' | 'forward') => void
  onViewAttachment?: (attachment: AttachmentMetadata) => void
  /** Whether message should be expanded by default. Defaults to false. */
  defaultExpanded?: boolean
}

export function MessageCard({
  message,
  cidMappings,
  attachments,
  onReply,
  onViewAttachment,
  defaultExpanded = false,
}: MessageCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showQuoted, setShowQuoted] = useState(false)
  const [showRecipients, setShowRecipients] = useState(false)

  // Split content into main body and quoted content
  const { mainContent, quotedContent, hasQuoted } = useMemo(() => {
    const text = message.bodyText || message.snippet || ''
    // Common patterns for quoted content
    const quotePatterns = [
      /^On .+wrote:$/m,  // "On Jan 10, 2026, at 2:42 PM, John wrote:"
      /^-+\s*Original Message\s*-+$/im,  // "--- Original Message ---"
      /^>{1,}/m,  // Lines starting with >
      /^From:\s+.+$/m,  // "From: someone@email.com"
    ]

    let splitIndex = -1
    for (const pattern of quotePatterns) {
      const match = text.search(pattern)
      if (match !== -1 && (splitIndex === -1 || match < splitIndex)) {
        splitIndex = match
      }
    }

    if (splitIndex > 0) {
      return {
        mainContent: text.slice(0, splitIndex).trim(),
        quotedContent: text.slice(splitIndex).trim(),
        hasQuoted: true,
      }
    }

    return { mainContent: text, quotedContent: '', hasQuoted: false }
  }, [message.bodyText, message.snippet])

  const sanitizedHtml = useMemo(() => {
    if (!message.bodyHtml) return null
    return sanitizeEmailHtml(message.bodyHtml, {
      externalMessageId: message.externalMessageId,
      cidMappings,
    })
  }, [message.bodyHtml, message.externalMessageId, cidMappings])

  // Format recipients for display
  const recipientDisplay = useMemo(() => {
    const recipients = message.toEmails || []
    if (recipients.length === 0) return 'Unknown'
    if (recipients.length === 1) return recipients[0].split('@')[0]
    return `${recipients[0].split('@')[0]} +${recipients.length - 1}`
  }, [message.toEmails])

  // Gmail-style collapsed view (for older messages in thread)
  if (!isExpanded) {
    return (
      <button
        type='button'
        onClick={() => setIsExpanded(true)}
        className='hover:bg-muted/30 flex w-full items-center gap-4 px-4 py-3 text-left transition-colors'
      >
        {/* Three dots in gray oval - Gmail style */}
        <div className='bg-muted/80 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full'>
          <ThreeDots className='text-muted-foreground h-4 w-4' />
        </div>

        {/* Sender name - fixed width like Gmail */}
        <span className='w-36 flex-shrink-0 truncate text-sm font-semibold'>
          {message.fromName || message.fromEmail?.split('@')[0] || 'Unknown'}
        </span>

        {/* Snippet preview - fills remaining space */}
        <span className='text-muted-foreground min-w-0 flex-1 truncate text-sm'>
          {message.snippet || '(no preview)'}
        </span>

        {/* Relative date */}
        <span className='text-muted-foreground flex-shrink-0 text-xs'>
          {formatDistanceToNow(new Date(message.sentAt), { addSuffix: false })}
        </span>
      </button>
    )
  }

  // Expanded view (Gmail-style 2-line header)
  return (
    <div className='bg-card'>
      {/* Header - Gmail style 2 lines */}
      <div className='flex w-full items-start gap-3 p-4'>
        {/* Avatar */}
        <div className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium text-white',
          message.isInbound ? 'bg-blue-500' : 'bg-emerald-500'
        )}>
          {(message.fromName || message.fromEmail || 'U')[0].toUpperCase()}
        </div>

        <div className='min-w-0 flex-1'>
          {/* Line 1: Name <email> */}
          <div className='flex items-baseline gap-2'>
            <span className='font-semibold'>
              {message.fromName || message.fromEmail?.split('@')[0] || 'Unknown'}
            </span>
            {message.fromEmail && (
              <span className='text-muted-foreground truncate text-xs'>
                &lt;{message.fromEmail}&gt;
              </span>
            )}
          </div>

          {/* Line 2: to Recipients - clickable to expand */}
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              setShowRecipients(!showRecipients)
            }}
            className='text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-1 text-xs transition-colors'
          >
            <span>to {recipientDisplay}</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', showRecipients && 'rotate-180')} />
          </button>

          {/* Expanded recipients panel */}
          {showRecipients && (
            <div className='bg-muted/50 mt-2 rounded-md p-3 text-xs'>
              <div className='space-y-1.5'>
                <div className='flex'>
                  <span className='text-muted-foreground w-12 flex-shrink-0'>From:</span>
                  <span className='min-w-0 flex-1'>
                    {message.fromName ? `${message.fromName} <${message.fromEmail}>` : message.fromEmail}
                  </span>
                </div>
                {message.toEmails && message.toEmails.length > 0 && (
                  <div className='flex'>
                    <span className='text-muted-foreground w-12 flex-shrink-0'>To:</span>
                    <span className='min-w-0 flex-1'>{message.toEmails.join(', ')}</span>
                  </div>
                )}
                {message.ccEmails && message.ccEmails.length > 0 && (
                  <div className='flex'>
                    <span className='text-muted-foreground w-12 flex-shrink-0'>Cc:</span>
                    <span className='min-w-0 flex-1'>{message.ccEmails.join(', ')}</span>
                  </div>
                )}
                <div className='flex'>
                  <span className='text-muted-foreground w-12 flex-shrink-0'>Date:</span>
                  <span className='min-w-0 flex-1'>
                    {format(new Date(message.sentAt), 'EEEE, MMMM d, yyyy \'at\' h:mm a')}
                  </span>
                </div>
                {message.subject && (
                  <div className='flex'>
                    <span className='text-muted-foreground w-12 flex-shrink-0'>Subject:</span>
                    <span className='min-w-0 flex-1'>{message.subject}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date - right aligned */}
        <div className='text-muted-foreground flex-shrink-0 text-xs'>
          {format(new Date(message.sentAt), 'MMM d, yyyy, h:mm a')}
        </div>
      </div>

      {/* Body */}
      <div className='px-4 pb-4 pl-[68px]'>
        {sanitizedHtml ? (
          <EmailIframe html={sanitizedHtml} />
        ) : message.bodyText ? (
          <div className='text-sm'>
            <pre className='whitespace-pre-wrap font-sans'>{mainContent}</pre>

            {/* Gmail-style "..." button for quoted content */}
            {hasQuoted && !showQuoted && (
              <button
                type='button'
                onClick={() => setShowQuoted(true)}
                className='bg-muted hover:bg-muted/80 mt-3 inline-flex items-center justify-center rounded-md px-2 py-1 transition-colors'
              >
                <ThreeDots className='text-muted-foreground h-4 w-4' />
              </button>
            )}

            {/* Quoted content - shown when expanded */}
            {hasQuoted && showQuoted && (
              <div className='text-muted-foreground mt-3 border-l-2 pl-3'>
                <pre className='whitespace-pre-wrap font-sans'>{quotedContent}</pre>
              </div>
            )}
          </div>
        ) : message.snippet ? (
          <p className='text-muted-foreground text-sm'>{message.snippet}</p>
        ) : (
          <p className='text-muted-foreground text-sm italic'>No content</p>
        )}

        {/* Attachments */}
        {attachments && attachments.length > 0 && onViewAttachment && (
          <AttachmentList
            attachments={attachments}
            onViewAttachment={onViewAttachment}
          />
        )}
      </div>

      {/* Reply Actions */}
      {onReply && (
        <>
          <Separator />
          <div className='flex items-center gap-2 p-3 pl-[68px]'>
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
    </div>
  )
}

// Re-export CidMapping type for convenience
export type { CidMapping }
