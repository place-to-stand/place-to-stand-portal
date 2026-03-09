'use client'

import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Calendar,
  Mail,
  MailOpen,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { ThreadSummary, Message } from '@/lib/types/messages'
import { MessageCard } from '@/app/(dashboard)/my/communications/_components/message-card'

type LeadEmailThreadsProps = {
  leadId: string | undefined
}

async function fetchLeadThreads(leadId: string): Promise<ThreadSummary[]> {
  const res = await fetch(`/api/leads/${leadId}/threads`)
  if (!res.ok) throw new Error('Failed to load threads')
  const data = await res.json()
  return data.threads ?? []
}

async function fetchThreadMessages(threadId: string): Promise<Message[]> {
  const res = await fetch(`/api/threads/${threadId}/messages`)
  if (!res.ok) throw new Error('Failed to load messages')
  const data = await res.json()
  return data.messages ?? []
}

export function LeadEmailThreads({ leadId }: LeadEmailThreadsProps) {
  const [selectedThread, setSelectedThread] = useState<ThreadSummary | null>(null)

  const {
    data: threads = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['lead-threads', leadId],
    queryFn: () => fetchLeadThreads(leadId!),
    enabled: Boolean(leadId),
  })

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <Mail className='text-muted-foreground h-4 w-4' />
        <span className='text-sm font-medium'>Emails</span>
        {threads.length > 0 && (
          <Badge variant='secondary' className='ml-auto text-xs'>
            {threads.length}
          </Badge>
        )}
      </div>

      {!leadId ? (
        <p className='text-muted-foreground text-xs'>
          Save the lead to view email threads.
        </p>
      ) : isLoading ? (
        <div className='flex items-center justify-center py-4'>
          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
        </div>
      ) : error ? (
        <p className='text-destructive text-xs'>
          {error instanceof Error ? error.message : 'Failed to load threads'}
        </p>
      ) : threads.length === 0 ? (
        <p className='text-muted-foreground text-xs'>
          No email threads linked to this lead.
        </p>
      ) : (
        <div className='rounded-md border'>
          <div className='divide-y'>
            {threads.map(thread => {
          const latestMessage = thread.latestMessage
          const isUnread = latestMessage && !latestMessage.isRead && latestMessage.isInbound

          return (
            <button
              key={thread.id}
              type="button"
              className={cn(
                'group flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors hover:bg-muted/50',
                isUnread && 'bg-muted/30'
              )}
              onClick={() => setSelectedThread(thread)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {isUnread ? (
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <MailOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      'truncate text-sm',
                      isUnread ? 'font-semibold' : 'font-medium'
                    )}
                  >
                    {thread.subject || '(no subject)'}
                  </span>
                </div>
                {thread.messageCount > 1 && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {thread.messageCount}
                  </Badge>
                )}
              </div>

              {latestMessage && (
                <div className="ml-6 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {latestMessage.isInbound
                      ? latestMessage.fromName || latestMessage.fromEmail
                      : 'You'}
                    : {latestMessage.snippet || '(empty)'}
                  </span>
                </div>
              )}

              {thread.lastMessageAt && (
                <div className="ml-6 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(thread.lastMessageAt), {
                    addSuffix: true,
                  })}
                </div>
              )}
            </button>
          )
            })}
          </div>
        </div>
      )}

      <ThreadDetailSheet
        thread={selectedThread}
        onClose={() => setSelectedThread(null)}
      />
    </div>
  )
}

function ThreadDetailSheet({
  thread,
  onClose,
}: {
  thread: ThreadSummary | null
  onClose: () => void
}) {
  const {
    data: messages = [],
    isLoading,
  } = useQuery({
    queryKey: ['thread-messages', thread?.id],
    queryFn: () => fetchThreadMessages(thread!.id),
    enabled: !!thread,
  })

  // Collect unique participants from messages
  const participants = messages.length > 0
    ? Array.from(
        new Map(
          messages.flatMap(m => {
            const entries: [string, string][] = []
            if (m.fromEmail) entries.push([m.fromEmail, m.fromName || m.fromEmail])
            m.toEmails?.forEach(e => entries.push([e, e]))
            return entries
          })
        ).entries()
      ).map(([email, name]) => ({ email, name }))
    : []

  return (
    <Sheet open={!!thread} onOpenChange={open => !open && onClose()}>
      <SheetContent
        className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-6xl'
        onOpenAutoFocus={e => e.preventDefault()}
      >
        {/* Header */}
        <div className='bg-muted/50 flex-shrink-0 border-b-2 px-6 pt-4 pb-3'>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0 flex-1 pr-10'>
              <SheetTitle className='line-clamp-2 text-lg'>
                {thread?.subject || '(no subject)'}
              </SheetTitle>
              <SheetDescription className='mt-1'>
                {thread?.messageCount} message{thread?.messageCount !== 1 ? 's' : ''}
                {thread?.lastMessageAt && (
                  <> &middot; {format(new Date(thread.lastMessageAt), 'PPp')}</>
                )}
              </SheetDescription>
            </div>
          </div>
        </div>

        {/* Two Column Content */}
        <div className='flex min-h-0 flex-1'>
          {/* Left Column - Email Messages */}
          <div className='flex-1 overflow-y-auto border-r'>
            <div className='p-6'>
              {isLoading ? (
                <div className='flex items-center justify-center py-12'>
                  <RefreshCw className='text-muted-foreground h-6 w-6 animate-spin' />
                </div>
              ) : messages.length === 0 ? (
                <div className='text-muted-foreground flex items-center justify-center py-12'>
                  No messages found
                </div>
              ) : (
                <div className='divide-y overflow-hidden rounded-lg border'>
                  {messages.map((message, index) => (
                    <MessageCard
                      key={message.id}
                      message={message}
                      defaultExpanded={index === messages.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div className='bg-muted/20 w-80 flex-shrink-0 overflow-y-auto lg:w-96'>
            <div className='space-y-6 p-6'>
              {/* Thread Details */}
              <div className='space-y-3'>
                <div className='flex items-center gap-2'>
                  <Mail className='text-muted-foreground h-4 w-4' />
                  <span className='text-sm font-medium'>Details</span>
                </div>
                <div className='space-y-2.5 text-sm'>
                  {thread?.messageCount && (
                    <div className='flex items-center gap-2.5 text-muted-foreground'>
                      <Mail className='h-3.5 w-3.5 flex-shrink-0' />
                      <span>
                        {thread.messageCount} message{thread.messageCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {thread?.lastMessageAt && (
                    <div className='flex items-center gap-2.5 text-muted-foreground'>
                      <Calendar className='h-3.5 w-3.5 flex-shrink-0' />
                      <span>{format(new Date(thread.lastMessageAt), 'PPp')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Participants */}
              {participants.length > 0 && (
                <>
                  <Separator />
                  <div className='space-y-3'>
                    <div className='flex items-center gap-2'>
                      <Users className='text-muted-foreground h-4 w-4' />
                      <span className='text-sm font-medium'>Participants</span>
                    </div>
                    <div className='space-y-2'>
                      {participants.map(p => (
                        <div key={p.email} className='text-sm'>
                          <div className='truncate font-medium'>{p.name}</div>
                          {p.name !== p.email && (
                            <div className='text-muted-foreground truncate text-xs'>{p.email}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
