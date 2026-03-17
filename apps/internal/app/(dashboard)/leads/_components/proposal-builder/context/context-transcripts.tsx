'use client'

import { useState, useEffect } from 'react'
import { Video, Loader2, ChevronDown, ChevronRight, Plus } from 'lucide-react'
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

type Meeting = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  transcriptStatus: string | null
  transcriptText: string | null
  transcriptFetchedAt: string | null
  conferenceId: string | null
}

type ContextTranscriptsProps = {
  leadId: string
  onInsert?: (text: string, source: string) => void
}

export function ContextTranscripts({ leadId, onInsert }: ContextTranscriptsProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMeetings() {
      try {
        const response = await fetch(`/api/leads/${leadId}/transcripts`)
        if (!response.ok) {
          throw new Error('Failed to fetch meetings')
        }
        const data = await response.json()
        setMeetings(data.meetings ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setIsLoading(false)
      }
    }

    fetchMeetings()
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

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Video className="mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">No meeting transcripts</p>
        <p className="text-xs">Transcripts from Google Meet will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {meetings.map(meeting => (
        <Collapsible
          key={meeting.id}
          open={expandedId === meeting.id}
          onOpenChange={open => setExpandedId(open ? meeting.id : null)}
        >
          <div className="rounded-lg border bg-background">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 h-auto text-left"
              >
                {expandedId === meeting.id ? (
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {meeting.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(meeting.startsAt), {
                        addSuffix: true,
                      })}
                    </span>
                    {meeting.transcriptStatus && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span className={meeting.transcriptStatus === 'FETCHED' ? 'text-emerald-600' : ''}>
                          {meeting.transcriptStatus === 'FETCHED' ? 'Has transcript' : meeting.transcriptStatus}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t px-3 py-2">
                {meeting.transcriptText ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        Transcript
                      </p>
                      {onInsert && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                onInsert(meeting.transcriptText!, `Meeting: ${meeting.title}`)
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
                    <p className="text-xs leading-relaxed line-clamp-6 whitespace-pre-wrap">
                      {meeting.transcriptText}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {meeting.transcriptStatus === 'PENDING'
                      ? 'Transcript is being processed...'
                      : meeting.transcriptStatus === 'NOT_FOUND'
                      ? 'No transcript available for this meeting'
                      : 'No transcript content'}
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  )
}
