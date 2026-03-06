'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  FileText,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

type TranscriptStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'AVAILABLE'
  | 'FETCHED'
  | 'NOT_RECORDED'
  | 'FAILED'

type MeetingWithTranscript = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  transcriptStatus: TranscriptStatus | null
  transcriptText: string | null
  transcriptFetchedAt: string | null
  conferenceId: string | null
}

type LeadMeetingTranscriptsProps = {
  leadId?: string
}

export function LeadMeetingTranscripts({ leadId }: LeadMeetingTranscriptsProps) {
  const [meetings, setMeetings] = useState<MeetingWithTranscript[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncingMeetingId, setSyncingMeetingId] = useState<string | null>(null)

  const fetchTranscripts = useCallback(async () => {
    if (!leadId) {
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/leads/${leadId}/transcripts`)
      if (response.ok) {
        const data = await response.json()
        setMeetings(data.meetings ?? [])
      }
    } catch (error) {
      console.error('Failed to fetch transcripts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchTranscripts()
  }, [fetchTranscripts])

  const handleSyncTranscript = useCallback(async (meetingId: string) => {
    setSyncingMeetingId(meetingId)
    try {
      const response = await fetch(`/api/meetings/${meetingId}/sync-transcript`, {
        method: 'POST',
      })
      if (response.ok) {
        // Refresh the list
        await fetchTranscripts()
      }
    } catch (error) {
      console.error('Failed to sync transcript:', error)
    } finally {
      setSyncingMeetingId(null)
    }
  }, [fetchTranscripts])

  if (!leadId) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Save the lead to see meeting transcripts.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (meetings.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No meetings with transcripts yet.</p>
        <p className="mt-1 text-xs">
          Schedule a meeting with a Google Meet link to automatically capture transcripts.
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {meetings.map(meeting => (
        <TranscriptCard
          key={meeting.id}
          meeting={meeting}
          isSyncing={syncingMeetingId === meeting.id}
          onSync={() => handleSyncTranscript(meeting.id)}
        />
      ))}
    </div>
  )
}

function TranscriptCard({
  meeting,
  isSyncing,
  onSync,
}: {
  meeting: MeetingWithTranscript
  isSyncing: boolean
  onSync: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const hasTranscript = meeting.transcriptStatus === 'FETCHED' && meeting.transcriptText

  return (
    <div className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{meeting.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(meeting.startsAt), 'MMM d, yyyy · h:mm a')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TranscriptStatusBadge status={meeting.transcriptStatus} />
          {canSync(meeting.transcriptStatus) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onSync}
              disabled={isSyncing}
              title="Sync transcript"
            >
              {isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {hasTranscript && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-between px-2 text-xs"
            >
              <span>View transcript</span>
              {isOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-md bg-muted/50 p-3">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed">
                {meeting.transcriptText}
              </pre>
            </div>
            {meeting.transcriptFetchedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Fetched {format(new Date(meeting.transcriptFetchedAt), 'MMM d, yyyy · h:mm a')}
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function TranscriptStatusBadge({ status }: { status: TranscriptStatus | null }) {
  if (!status) return null

  const config: Record<
    TranscriptStatus,
    { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon?: React.ReactNode }
  > = {
    PENDING: {
      label: 'Pending',
      variant: 'secondary',
      icon: <Clock className="mr-1 h-3 w-3" />,
    },
    PROCESSING: {
      label: 'Processing',
      variant: 'secondary',
      icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    },
    AVAILABLE: {
      label: 'Available',
      variant: 'outline',
    },
    FETCHED: {
      label: 'Ready',
      variant: 'default',
      icon: <FileText className="mr-1 h-3 w-3" />,
    },
    NOT_RECORDED: {
      label: 'No transcript',
      variant: 'outline',
    },
    FAILED: {
      label: 'Failed',
      variant: 'destructive',
      icon: <AlertCircle className="mr-1 h-3 w-3" />,
    },
  }

  const { label, variant, icon } = config[status]

  return (
    <Badge variant={variant} className="text-xs">
      {icon}
      {label}
    </Badge>
  )
}

function canSync(status: TranscriptStatus | null): boolean {
  return status === 'PENDING' || status === 'PROCESSING' || status === 'AVAILABLE' || status === 'FAILED'
}
