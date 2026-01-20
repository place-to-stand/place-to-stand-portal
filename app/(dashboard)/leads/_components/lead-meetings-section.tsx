'use client'

import { useState } from 'react'
import { format, isPast, isFuture } from 'date-fns'
import { Calendar, Video, Clock, ExternalLink, Plus, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { GoogleMeetingRef, LeadRecord } from '@/lib/leads/types'

import { ScheduleMeetingDialog } from './schedule-meeting-dialog'

type LeadMeetingsSectionProps = {
  lead: LeadRecord
  canManage: boolean
  onSuccess?: () => void
}

export function LeadMeetingsSection({
  lead,
  canManage,
  onSuccess,
}: LeadMeetingsSectionProps) {
  const [isDialogOpen, setDialogOpen] = useState(false)

  const meetings = lead.googleMeetings ?? []

  // Sort meetings: upcoming first, then past
  const sortedMeetings = [...meetings].sort((a, b) => {
    const aDate = new Date(a.startsAt)
    const bDate = new Date(b.startsAt)
    const aIsPast = isPast(aDate)
    const bIsPast = isPast(bDate)

    // Upcoming first
    if (!aIsPast && bIsPast) return -1
    if (aIsPast && !bIsPast) return 1

    // Within same category, sort by date
    return aDate.getTime() - bDate.getTime()
  })

  const upcomingMeetings = sortedMeetings.filter(m => isFuture(new Date(m.startsAt)))
  const pastMeetings = sortedMeetings.filter(m => isPast(new Date(m.startsAt)))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Meetings</span>
          {meetings.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {meetings.length}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Schedule
          </Button>
        )}
      </div>

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meetings scheduled yet.</p>
      ) : (
        <div className="space-y-2">
          {/* Upcoming meetings */}
          {upcomingMeetings.length > 0 && (
            <div className="space-y-2">
              {upcomingMeetings.map(meeting => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}

          {/* Past meetings (collapsed if many) */}
          {pastMeetings.length > 0 && (
            <div className="space-y-2">
              {upcomingMeetings.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground pt-2">Past</p>
              )}
              {pastMeetings.slice(0, 3).map(meeting => (
                <MeetingCard key={meeting.id} meeting={meeting} isPast />
              ))}
              {pastMeetings.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{pastMeetings.length - 3} more past meetings
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <ScheduleMeetingDialog
        lead={lead}
        open={isDialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false)
          onSuccess?.()
        }}
      />
    </div>
  )
}

function MeetingCard({
  meeting,
  isPast = false,
}: {
  meeting: GoogleMeetingRef
  isPast?: boolean
}) {
  const startDate = new Date(meeting.startsAt)
  const endDate = new Date(meeting.endsAt)

  return (
    <div
      className={`rounded-lg border p-3 ${isPast ? 'bg-muted/20 opacity-70' : 'bg-muted/30'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{meeting.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {format(startDate, 'MMM d, yyyy')} · {format(startDate, 'h:mm a')} -{' '}
              {format(endDate, 'h:mm a')}
            </span>
          </div>
          {meeting.attendeeEmails.length > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span className="truncate">
                {meeting.attendeeEmails.slice(0, 2).join(', ')}
                {meeting.attendeeEmails.length > 2 &&
                  ` +${meeting.attendeeEmails.length - 2}`}
              </span>
            </div>
          )}
        </div>
        {meeting.meetLink && (
          <a
            href={meeting.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-500/20"
          >
            <Video className="h-3 w-3" />
            Join
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  )
}
