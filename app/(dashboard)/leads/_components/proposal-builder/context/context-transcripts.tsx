'use client'

import { useState, useEffect } from 'react'
import { Video, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

type Transcript = {
  id: string
  title: string
  meetingDate: string
  summary: string | null
  content: string
}

type ContextTranscriptsProps = {
  leadId: string
}

export function ContextTranscripts({ leadId }: ContextTranscriptsProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTranscripts() {
      try {
        const response = await fetch(`/api/leads/${leadId}/transcripts`)
        if (!response.ok) {
          throw new Error('Failed to fetch transcripts')
        }
        const data = await response.json()
        setTranscripts(data.transcripts ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTranscripts()
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

  if (transcripts.length === 0) {
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
      {transcripts.map(transcript => (
        <Collapsible
          key={transcript.id}
          open={expandedId === transcript.id}
          onOpenChange={open => setExpandedId(open ? transcript.id : null)}
        >
          <div className="rounded-lg border bg-background">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 h-auto text-left"
              >
                {expandedId === transcript.id ? (
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {transcript.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(transcript.meetingDate), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t px-3 py-2">
                {transcript.summary ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Summary
                    </p>
                    <p className="text-xs leading-relaxed">
                      {transcript.summary}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No summary available
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
