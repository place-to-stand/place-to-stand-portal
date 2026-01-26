'use client'

import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Mail,
  MailOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { ThreadSummary } from '@/lib/types/messages'
import { EmailIframe } from '@/app/(dashboard)/my/inbox/_components/email-iframe'

type LeadEmailThreadsProps = {
  leadId: string | undefined
}

type Message = {
  id: string
  fromEmail: string
  fromName: string | null
  toEmails: string[]
  sentAt: string
  isInbound: boolean
  isRead: boolean
  snippet: string | null
  bodyHtml: string | null
  bodyText: string | null
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
  const {
    data: threads = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['lead-threads', leadId],
    queryFn: () => fetchLeadThreads(leadId!),
    enabled: Boolean(leadId),
  })

  if (!leadId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Mail className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Save the lead to view email threads</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load threads'}
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Mail className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No email threads</p>
        <p className="mt-1 text-xs">
          Emails will appear here when matched to this lead&apos;s contact email
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {threads.map(thread => (
        <ThreadRow key={thread.id} thread={thread} />
      ))}
    </div>
  )
}

function ThreadRow({ thread }: { thread: ThreadSummary }) {
  const [isOpen, setIsOpen] = useState(false)
  const latestMessage = thread.latestMessage
  const isUnread = latestMessage && !latestMessage.isRead && latestMessage.isInbound

  const {
    data: messages = [],
    isLoading: isLoadingMessages,
  } = useQuery({
    queryKey: ['thread-messages', thread.id],
    queryFn: () => fetchThreadMessages(thread.id),
    enabled: isOpen,
  })

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'group flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors hover:bg-muted/50',
            isUnread && 'bg-muted/30'
          )}
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
            <div className="flex shrink-0 items-center gap-2">
              {thread.messageCount > 1 && (
                <Badge variant="secondary" className="text-xs">
                  {thread.messageCount}
                </Badge>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {latestMessage && !isOpen && (
            <div className="ml-6 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">
                {latestMessage.isInbound
                  ? latestMessage.fromName || latestMessage.fromEmail
                  : 'You'}
                : {latestMessage.snippet || '(empty)'}
              </span>
            </div>
          )}

          {!isOpen && thread.lastMessageAt && (
            <div className="ml-6 flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {formatDistanceToNow(new Date(thread.lastMessageAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t bg-muted/20 px-3 py-2">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No messages found
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((message, idx) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  isLast={idx === messages.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function MessageCard({
  message,
  isLast,
}: {
  message: Message
  isLast: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(isLast) // Auto-expand most recent

  return (
    <div
      className={cn(
        'rounded-md border bg-background p-3',
        message.isInbound ? 'border-l-2 border-l-blue-500' : 'border-l-2 border-l-green-500'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {message.isInbound ? (
            <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
          )}
          <span className="font-medium">
            {message.fromName || message.fromEmail}
          </span>
          {message.fromName && (
            <span className="text-xs text-muted-foreground">
              &lt;{message.fromEmail}&gt;
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {format(new Date(message.sentAt), 'MMM d, h:mm a')}
        </span>
      </div>

      {/* Content */}
      {isExpanded ? (
        <div className="mt-2">
          {message.bodyHtml ? (
            <div className="max-h-80 overflow-y-auto rounded border">
              <EmailIframe html={message.bodyHtml} />
            </div>
          ) : message.bodyText ? (
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 text-sm">
              {message.bodyText}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">{message.snippet}</p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-6 text-xs"
            onClick={() => setIsExpanded(false)}
          >
            Collapse
          </Button>
        </div>
      ) : (
        <button
          className="mt-1 w-full text-left"
          onClick={() => setIsExpanded(true)}
        >
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {message.snippet || '(empty message)'}
          </p>
        </button>
      )}
    </div>
  )
}
