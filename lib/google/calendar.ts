import 'server-only'

import { getValidAccessToken, OAuthReconnectRequiredError } from '@/lib/gmail/client'

// Re-export for consumers
export { OAuthReconnectRequiredError }

// =============================================================================
// Types
// =============================================================================

export interface CalendarEvent {
  id: string
  status: string
  htmlLink: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  attendees?: CalendarAttendee[]
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string
      uri: string
      label?: string
    }>
    conferenceSolution?: {
      name: string
      iconUri?: string
    }
  }
  hangoutLink?: string
  creator?: {
    email: string
    displayName?: string
    self?: boolean
  }
  organizer?: {
    email: string
    displayName?: string
    self?: boolean
  }
}

export interface CalendarAttendee {
  email: string
  displayName?: string
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted'
  optional?: boolean
  organizer?: boolean
  self?: boolean
}

export interface FreeBusyResponse {
  kind: string
  timeMin: string
  timeMax: string
  calendars: Record<
    string,
    {
      busy: Array<{
        start: string
        end: string
      }>
      errors?: Array<{
        domain: string
        reason: string
      }>
    }
  >
}

export interface CreateEventParams {
  summary: string
  description?: string
  startDateTime: string // ISO datetime
  endDateTime: string // ISO datetime
  timeZone?: string
  attendees?: string[] // Email addresses
  sendUpdates?: 'all' | 'externalOnly' | 'none'
  addMeetLink?: boolean
}

export interface GetFreeBusyParams {
  timeMin: string // ISO datetime
  timeMax: string // ISO datetime
  calendars?: string[] // Calendar IDs (defaults to 'primary')
  timeZone?: string
}

// =============================================================================
// Calendar API Functions
// =============================================================================

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

/**
 * Create a calendar event with optional Google Meet link.
 */
export async function createCalendarEvent(
  userId: string,
  params: CreateEventParams,
  options?: { connectionId?: string }
): Promise<CalendarEvent> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = new URL(`${CALENDAR_API_BASE}/calendars/primary/events`)

  // Request Meet link generation
  if (params.addMeetLink) {
    url.searchParams.set('conferenceDataVersion', '1')
  }

  // Send notifications to attendees
  url.searchParams.set('sendUpdates', params.sendUpdates ?? 'all')

  const eventBody: Record<string, unknown> = {
    summary: params.summary,
    start: {
      dateTime: params.startDateTime,
      timeZone: params.timeZone ?? 'America/Los_Angeles',
    },
    end: {
      dateTime: params.endDateTime,
      timeZone: params.timeZone ?? 'America/Los_Angeles',
    },
  }

  if (params.description) {
    eventBody.description = params.description
  }

  if (params.attendees?.length) {
    eventBody.attendees = params.attendees.map(email => ({ email }))
  }

  // Add Meet link configuration
  if (params.addMeetLink) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    }
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Calendar event creation failed: ${errorText}`)
  }

  return res.json()
}

/**
 * Get a calendar event by ID.
 */
export async function getCalendarEvent(
  userId: string,
  eventId: string,
  options?: { connectionId?: string }
): Promise<CalendarEvent> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to get calendar event: ${errorText}`)
  }

  return res.json()
}

/**
 * Delete a calendar event by ID.
 */
export async function deleteCalendarEvent(
  userId: string,
  eventId: string,
  options?: { connectionId?: string; sendUpdates?: 'all' | 'externalOnly' | 'none' }
): Promise<void> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = new URL(
    `${CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`
  )
  url.searchParams.set('sendUpdates', options?.sendUpdates ?? 'all')

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to delete calendar event: ${errorText}`)
  }
}

/**
 * Update a calendar event.
 */
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  params: Partial<CreateEventParams>,
  options?: { connectionId?: string }
): Promise<CalendarEvent> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = new URL(
    `${CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`
  )
  url.searchParams.set('sendUpdates', params.sendUpdates ?? 'all')

  const eventBody: Record<string, unknown> = {}

  if (params.summary) {
    eventBody.summary = params.summary
  }

  if (params.description !== undefined) {
    eventBody.description = params.description
  }

  if (params.startDateTime) {
    eventBody.start = {
      dateTime: params.startDateTime,
      timeZone: params.timeZone ?? 'America/Los_Angeles',
    }
  }

  if (params.endDateTime) {
    eventBody.end = {
      dateTime: params.endDateTime,
      timeZone: params.timeZone ?? 'America/Los_Angeles',
    }
  }

  if (params.attendees) {
    eventBody.attendees = params.attendees.map(email => ({ email }))
  }

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to update calendar event: ${errorText}`)
  }

  return res.json()
}

/**
 * Query free/busy information for calendars.
 * Used to find available time slots for scheduling.
 */
export async function getFreeBusy(
  userId: string,
  params: GetFreeBusyParams,
  options?: { connectionId?: string }
): Promise<FreeBusyResponse> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const calendars = params.calendars ?? ['primary']

  const requestBody = {
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    timeZone: params.timeZone ?? 'America/Los_Angeles',
    items: calendars.map(id => ({ id })),
  }

  const res = await fetch(`${CALENDAR_API_BASE}/freeBusy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to get free/busy info: ${errorText}`)
  }

  return res.json()
}

/**
 * Extract Google Meet link from a calendar event.
 */
export function extractMeetLink(event: CalendarEvent): string | null {
  // Check hangoutLink first (legacy but still works)
  if (event.hangoutLink) {
    return event.hangoutLink
  }

  // Check conferenceData entry points
  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      ep => ep.entryPointType === 'video'
    )
    if (videoEntry?.uri) {
      return videoEntry.uri
    }
  }

  return null
}
