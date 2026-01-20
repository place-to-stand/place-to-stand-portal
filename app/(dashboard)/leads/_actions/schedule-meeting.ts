'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import {
  createCalendarEvent,
  extractMeetLink,
  type CalendarEvent,
} from '@/lib/google/calendar'
import type { GoogleMeetingRef } from '@/lib/leads/types'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const scheduleMeetingSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(1, 'Meeting title is required').max(200),
  description: z.string().trim().max(2000).optional(),
  startDateTime: z.string().datetime({ message: 'Invalid start time' }),
  endDateTime: z.string().datetime({ message: 'Invalid end time' }),
  timeZone: z.string().default('America/Los_Angeles'),
  attendeeEmails: z.array(z.string().email()).optional(),
  addMeetLink: z.boolean().default(true),
})

export type ScheduleMeetingInput = z.infer<typeof scheduleMeetingSchema>

export type ScheduleMeetingResult = LeadActionResult & {
  meeting?: GoogleMeetingRef
}

export async function scheduleMeeting(
  input: ScheduleMeetingInput
): Promise<ScheduleMeetingResult> {
  const user = await requireUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  assertAdmin(user)

  const parsed = scheduleMeetingSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid meeting payload.',
    }
  }

  const { leadId, title, description, startDateTime, endDateTime, timeZone, attendeeEmails, addMeetLink } =
    parsed.data

  // Validate time range
  const start = new Date(startDateTime)
  const end = new Date(endDateTime)

  if (end <= start) {
    return {
      success: false,
      error: 'End time must be after start time.',
    }
  }

  // Fetch the lead to get existing meetings
  const existingLeads = await db
    .select({
      id: leads.id,
      contactEmail: leads.contactEmail,
      googleMeetings: leads.googleMeetings,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  const lead = existingLeads[0]

  if (!lead) {
    return { success: false, error: 'Lead not found.' }
  }

  // Build attendee list - include lead's email if available
  const allAttendees = [...(attendeeEmails ?? [])]
  if (lead.contactEmail && !allAttendees.includes(lead.contactEmail)) {
    allAttendees.push(lead.contactEmail)
  }

  let calendarEvent: CalendarEvent

  try {
    calendarEvent = await createCalendarEvent(user.id, {
      summary: title,
      description,
      startDateTime,
      endDateTime,
      timeZone,
      attendees: allAttendees.length > 0 ? allAttendees : undefined,
      addMeetLink,
      sendUpdates: 'all',
    })
  } catch (error) {
    console.error('Failed to create calendar event', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create calendar event. Please check your Google connection.',
    }
  }

  // Build the meeting reference
  const meetLink = extractMeetLink(calendarEvent)
  const now = new Date().toISOString()

  const meetingRef: GoogleMeetingRef = {
    id: randomUUID(),
    eventId: calendarEvent.id,
    meetLink,
    title: calendarEvent.summary,
    startsAt: startDateTime,
    endsAt: endDateTime,
    attendeeEmails: allAttendees,
    createdAt: now,
    createdBy: user.id,
  }

  // Update lead with new meeting
  const existingMeetings = (lead.googleMeetings as GoogleMeetingRef[]) ?? []

  try {
    await db
      .update(leads)
      .set({
        googleMeetings: [...existingMeetings, meetingRef],
        updatedAt: now,
      })
      .where(eq(leads.id, leadId))
  } catch (error) {
    console.error('Failed to save meeting to lead', error)
    // Note: Calendar event was created, we just failed to save reference
    return {
      success: false,
      error: 'Meeting was created in Google Calendar but failed to save to lead.',
    }
  }

  revalidateLeadsPath()

  return {
    success: true,
    meeting: meetingRef,
  }
}
