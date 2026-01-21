'use client'

import { useCallback, useState, useTransition } from 'react'
import { format, addHours, startOfHour } from 'date-fns'
import { Calendar, Clock, Loader2, Video, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import type { LeadRecord } from '@/lib/leads/types'
import type { Meeting } from '@/lib/queries/meetings'

import { scheduleMeeting } from '../_actions'

type ScheduleMeetingDialogProps = {
  lead: LeadRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (meeting: Meeting) => void
  /** Pre-filled title from AI suggestion */
  initialTitle?: string
}

// Use key-based remounting to reset form state when dialog opens
export function ScheduleMeetingDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
  initialTitle,
}: ScheduleMeetingDialogProps) {
  // Key changes when dialog opens to remount form and reset state
  const [formKey, setFormKey] = useState(0)

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setFormKey(k => k + 1)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <ScheduleMeetingSheetContent
        key={formKey}
        lead={lead}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        initialTitle={initialTitle}
      />
    </Sheet>
  )
}

function ScheduleMeetingSheetContent({
  lead,
  onOpenChange,
  onSuccess,
  initialTitle,
}: Omit<ScheduleMeetingDialogProps, 'open'>) {
  const { toast } = useToast()
  const [isScheduling, startScheduleTransition] = useTransition()

  // Form fields with defaults computed once on mount
  const [title, setTitle] = useState(
    () => initialTitle ?? `Meeting with ${lead.contactName}`
  )
  const [description, setDescription] = useState('')
  const [startDateTime, setStartDateTime] = useState(() => {
    const nextHour = startOfHour(addHours(new Date(), 1))
    return formatDateTimeLocal(nextHour)
  })
  const [endDateTime, setEndDateTime] = useState(() => {
    const nextHour = startOfHour(addHours(new Date(), 1))
    const endTime = addHours(nextHour, 0.5) // 30 min default
    return formatDateTimeLocal(endTime)
  })
  const [addMeetLink, setAddMeetLink] = useState(true)
  const [additionalAttendees, setAdditionalAttendees] = useState('')

  // Update end time when start time changes (keep duration)
  const handleStartTimeChange = useCallback(
    (newStart: string) => {
      setStartDateTime(newStart)

      // If we have a valid end time, maintain the duration
      if (startDateTime && endDateTime) {
        const prevStart = new Date(startDateTime)
        const prevEnd = new Date(endDateTime)
        const duration = prevEnd.getTime() - prevStart.getTime()

        const newStartDate = new Date(newStart)
        const newEndDate = new Date(newStartDate.getTime() + duration)
        setEndDateTime(formatDateTimeLocal(newEndDate))
      }
    },
    [startDateTime, endDateTime]
  )

  const handleSchedule = useCallback(() => {
    if (!title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing title',
        description: 'Please enter a meeting title.',
      })
      return
    }

    if (!startDateTime || !endDateTime) {
      toast({
        variant: 'destructive',
        title: 'Missing time',
        description: 'Please select start and end times.',
      })
      return
    }

    const start = new Date(startDateTime)
    const end = new Date(endDateTime)

    if (end <= start) {
      toast({
        variant: 'destructive',
        title: 'Invalid time range',
        description: 'End time must be after start time.',
      })
      return
    }

    // Parse additional attendees
    const extraEmails = additionalAttendees
      .split(/[,;\s]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'))

    startScheduleTransition(async () => {
      const result = await scheduleMeeting({
        leadId: lead.id,
        title: title.trim(),
        description: description.trim() || undefined,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        attendeeEmails: extraEmails.length > 0 ? extraEmails : undefined,
        addMeetLink,
      })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to schedule meeting',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      const meetingTime = `${format(start, 'PPp')} - ${format(end, 'p')}`
      toast({
        title: 'Meeting scheduled',
        description: result.meeting?.meetLink
          ? `${meetingTime}. Google Meet link created.`
          : meetingTime,
      })

      onOpenChange(false)
      if (result.meeting) {
        onSuccess?.(result.meeting)
      }
    })
  }, [
    lead.id,
    title,
    description,
    startDateTime,
    endDateTime,
    addMeetLink,
    additionalAttendees,
    toast,
    onOpenChange,
    onSuccess,
  ])

  const canSchedule = title.trim() && startDateTime && endDateTime && !isScheduling

  return (
    <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
      <SheetHeader className="bg-transparent p-0 px-6 pt-6">
        <SheetTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Schedule Meeting
        </SheetTitle>
        <SheetDescription>
          Create a calendar event with {lead.contactName}
          {lead.contactEmail && ` (${lead.contactEmail})`}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Meeting title"
            />
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Start
              </Label>
              <Input
                id="start-time"
                type="datetime-local"
                value={startDateTime}
                onChange={e => handleStartTimeChange(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">End</Label>
              <Input
                id="end-time"
                type="datetime-local"
                value={endDateTime}
                onChange={e => setEndDateTime(e.target.value)}
                min={startDateTime}
              />
            </div>
          </div>

          {/* Google Meet toggle */}
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              id="add-meet"
              checked={addMeetLink}
              onCheckedChange={checked => setAddMeetLink(checked === true)}
            />
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="add-meet" className="text-sm font-medium cursor-pointer">
                  Add Google Meet
                </Label>
                <p className="text-xs text-muted-foreground">
                  Include video conference link
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Meeting agenda or notes..."
              rows={3}
            />
          </div>

          {/* Additional Attendees */}
          <div className="space-y-2">
            <Label htmlFor="attendees" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Additional Attendees (optional)
            </Label>
            <Input
              id="attendees"
              value={additionalAttendees}
              onChange={e => setAdditionalAttendees(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
            />
            <p className="text-xs text-muted-foreground">
              {lead.contactEmail
                ? `${lead.contactEmail} will be invited automatically`
                : 'Add email addresses separated by commas'}
            </p>
          </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isScheduling}
        >
          Cancel
        </Button>
        <Button onClick={handleSchedule} disabled={!canSchedule}>
          {isScheduling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scheduling...
            </>
          ) : (
            <>
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Meeting
            </>
          )}
        </Button>
      </div>
    </SheetContent>
  )
}

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
