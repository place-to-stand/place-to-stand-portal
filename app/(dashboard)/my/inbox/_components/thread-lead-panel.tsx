'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  UserPlus,
  X,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Target,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ThreadSummary, Message } from '@/lib/types/messages'

import { CreateLeadFromThreadDialog } from './create-lead-from-thread-dialog'

type Lead = {
  id: string
  contactName: string
}

type LeadSuggestion = {
  leadId: string
  contactName: string
  contactEmail: string
  confidence: number
  matchType?: string
  reasoning?: string
}

type ThreadLeadPanelProps = {
  thread: ThreadSummary
  threadMessages: Message[]
  leads: Lead[]
  isLinking: boolean
  onLinkLead: (leadId: string) => void
  onUnlinkLead: () => void
  onLeadCreated?: (leadId: string) => void
}

export function ThreadLeadPanel({
  thread,
  threadMessages,
  leads,
  isLinking,
  onLinkLead,
  onUnlinkLead,
  onLeadCreated,
}: ThreadLeadPanelProps) {
  const [selectedLead, setSelectedLead] = useState('')
  const [isManualOpen, setIsManualOpen] = useState(false)
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false)

  // Suggestions state - use object to track both data and what it was loaded for
  const [fetchState, setFetchState] = useState<{
    loadedFor: string | null
    suggestions: LeadSuggestion[]
  }>({ loadedFor: null, suggestions: [] })

  // Cache key: null when lead exists (no need to fetch), otherwise includes thread state
  const fetchKey = thread.lead ? null : `${thread.id}:unlinked`

  // Derive loading state from comparing what we need vs what we have
  const suggestionsLoading = fetchKey !== null && fetchKey !== fetchState.loadedFor
  const suggestions = fetchState.suggestions

  // Fetch lead suggestions when thread changes and has no lead
  useEffect(() => {
    // Don't fetch if thread has a lead or we already loaded for this key
    if (!fetchKey || fetchKey === fetchState.loadedFor) {
      return
    }

    let cancelled = false
    const currentFetchKey = fetchKey

    fetch(`/api/threads/${thread.id}/lead-suggestions`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.ok) {
          setFetchState({
            loadedFor: currentFetchKey,
            suggestions: data.suggestions || [],
          })
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Failed to load lead suggestions:', err)
          // Mark as loaded (with empty results) to stop retry loop
          setFetchState({
            loadedFor: currentFetchKey,
            suggestions: [],
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [fetchKey, fetchState.loadedFor, thread.id])

  // Filter out already-linked lead from options
  const availableLeads = thread.lead
    ? leads.filter(l => l.id !== thread.lead?.id)
    : leads

  const handleLinkFromSuggestion = (leadId: string) => {
    onLinkLead(leadId)
    setSelectedLead('')
  }

  const handleLinkFromManual = () => {
    if (selectedLead) {
      onLinkLead(selectedLead)
      setSelectedLead('')
      setIsManualOpen(false)
    }
  }

  const handleLeadCreated = useCallback(
    (leadId: string) => {
      // Link the newly created lead to the thread
      onLinkLead(leadId)
      onLeadCreated?.(leadId)
    },
    [onLinkLead, onLeadCreated]
  )

  // Extract sender info from first inbound message for pre-filling create dialog
  const firstInboundMessage = threadMessages.find(m => m.isInbound)
  const senderInfo = firstInboundMessage
    ? {
        email: firstInboundMessage.fromEmail,
        name: firstInboundMessage.fromName,
      }
    : null

  return (
    <div className='space-y-3'>
      {/* Section Header */}
      <div className='flex items-center gap-2'>
        <Target className='text-muted-foreground h-4 w-4' />
        <span className='text-sm font-medium'>Lead Association</span>
      </div>

      {/* Current Link Status */}
      {thread.lead ? (
        <div className='bg-muted/30 rounded-lg border p-2'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Target className='h-4 w-4 text-orange-500' />
              <Link
                href={`/leads/board/${thread.lead.id}`}
                className='hover:text-primary font-medium underline-offset-4 hover:underline'
              >
                {thread.lead.contactName}
              </Link>
              <Badge variant='secondary' className='text-xs'>
                Linked
              </Badge>
            </div>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={onUnlinkLead}
              disabled={isLinking}
            >
              {isLinking ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <X className='h-4 w-4' />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* AI Suggestions */}
          <div className='space-y-2'>
            <div className='text-muted-foreground flex items-center gap-2 text-xs'>
              <Sparkles className='h-3 w-3' />
              <span>Suggestions</span>
            </div>

            {suggestionsLoading ? (
              <div className='bg-muted/30 flex items-center gap-2 rounded-lg border p-3'>
                <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
                <span className='text-muted-foreground text-sm'>
                  Analyzing...
                </span>
              </div>
            ) : suggestions.length > 0 ? (
              <TooltipProvider delayDuration={200}>
                <div className='space-y-2'>
                  {suggestions.map(s => (
                    <div
                      key={s.leadId}
                      className='bg-muted/30 flex items-center justify-between gap-2 rounded-lg border p-2'
                    >
                      <div className='flex min-w-0 items-center gap-2'>
                        <Target className='text-muted-foreground h-4 w-4 shrink-0' />
                        <span className='truncate text-sm font-medium'>
                          {s.contactName}
                        </span>
                        <Badge
                          variant={
                            s.confidence >= 0.8 ? 'default' : 'secondary'
                          }
                          className='shrink-0 text-xs'
                        >
                          {Math.round(s.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className='flex shrink-0 items-center gap-1'>
                        <Button
                          size='sm'
                          variant='outline'
                          className='h-7 text-xs'
                          onClick={() => handleLinkFromSuggestion(s.leadId)}
                          disabled={isLinking}
                        >
                          {isLinking ? (
                            <Loader2 className='h-3 w-3 animate-spin' />
                          ) : (
                            'Link'
                          )}
                        </Button>
                        {s.reasoning && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type='button'
                                className='text-muted-foreground hover:text-foreground p-1 transition-colors'
                              >
                                <HelpCircle className='h-4 w-4' />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side='left' className='max-w-xs'>
                              <p className='text-sm'>{s.reasoning}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            ) : (
              <p className='text-muted-foreground text-sm'>
                No lead matches found.
              </p>
            )}
          </div>

          {/* Create New Lead */}
          {senderInfo && (
            <Button
              variant='outline'
              size='sm'
              className='w-full gap-2'
              onClick={() => setCreateDialogOpen(true)}
            >
              <UserPlus className='h-4 w-4' />
              Create Lead from Email
            </Button>
          )}

          {/* Manual Link - Collapsible */}
          {availableLeads.length > 0 && (
            <Collapsible open={isManualOpen} onOpenChange={setIsManualOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground w-full justify-between text-xs'
                >
                  <span>Link to existing lead</span>
                  {isManualOpen ? (
                    <ChevronUp className='h-3 w-3' />
                  ) : (
                    <ChevronDown className='h-3 w-3' />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className='pt-2'>
                <div className='flex gap-2'>
                  <Select
                    value={selectedLead}
                    onValueChange={setSelectedLead}
                  >
                    <SelectTrigger className='h-8 flex-1 text-sm'>
                      <SelectValue placeholder='Select lead...' />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLeads.map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.contactName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size='sm'
                    className='h-8'
                    onClick={handleLinkFromManual}
                    disabled={!selectedLead || isLinking}
                  >
                    {isLinking ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      'Link'
                    )}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      {/* Create Lead Dialog */}
      {senderInfo && (
        <CreateLeadFromThreadDialog
          open={isCreateDialogOpen}
          onOpenChange={setCreateDialogOpen}
          threadId={thread.id}
          senderEmail={senderInfo.email}
          senderName={senderInfo.name}
          subject={thread.subject}
          onSuccess={handleLeadCreated}
        />
      )}
    </div>
  )
}
