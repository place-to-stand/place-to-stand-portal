'use client'

import { useState, useEffect } from 'react'
import { Mail, Loader2, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type EmailThread = {
  id: string
  subject: string
  lastMessageAt: string
  messageCount: number
  snippet: string
}

type ContextEmailsProps = {
  leadId: string
  onInsert?: (text: string, source: string) => void
}

export function ContextEmails({ leadId, onInsert }: ContextEmailsProps) {
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEmailThreads() {
      try {
        const response = await fetch(`/api/leads/${leadId}/emails`)
        if (!response.ok) {
          throw new Error('Failed to fetch emails')
        }
        const data = await response.json()
        setThreads(data.threads ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEmailThreads()
  }, [leadId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <p>{error}</p>
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Mail className="mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">No email threads</p>
        <p className="text-xs">Email history with this lead will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {threads.map(thread => (
        <Collapsible
          key={thread.id}
          open={expandedId === thread.id}
          onOpenChange={open => setExpandedId(open ? thread.id : null)}
        >
          <div className="rounded-lg border bg-background">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 h-auto text-left"
              >
                {expandedId === thread.id ? (
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {thread.subject || '(No subject)'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(thread.lastMessageAt), {
                        addSuffix: true,
                      })}
                    </span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{thread.messageCount} messages</span>
                  </div>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs leading-relaxed text-muted-foreground flex-1">
                    {thread.snippet}
                  </p>
                  {onInsert && thread.snippet && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            onInsert(thread.snippet, `Email: ${thread.subject || 'No subject'}`)
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Insert
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Insert into Project Overview</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  )
}
