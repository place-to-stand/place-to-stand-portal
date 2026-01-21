import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { meetings, users } from '@/lib/db/schema'

export type MeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export type Meeting = {
  id: string
  leadId: string | null
  clientId: string | null
  title: string
  description: string | null
  status: MeetingStatus
  startsAt: string
  endsAt: string
  meetLink: string | null
  calendarEventId: string | null
  attendeeEmails: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type MeetingWithCreator = Meeting & {
  creator: {
    id: string
    fullName: string | null
    email: string | null
    avatarUrl: string | null
  } | null
}

/**
 * Fetch meetings for a specific lead.
 */
export async function fetchMeetingsByLeadId(
  leadId: string
): Promise<MeetingWithCreator[]> {
  const rows = await db
    .select({
      id: meetings.id,
      leadId: meetings.leadId,
      clientId: meetings.clientId,
      title: meetings.title,
      description: meetings.description,
      status: meetings.status,
      startsAt: meetings.startsAt,
      endsAt: meetings.endsAt,
      meetLink: meetings.meetLink,
      calendarEventId: meetings.calendarEventId,
      attendeeEmails: meetings.attendeeEmails,
      createdBy: meetings.createdBy,
      createdAt: meetings.createdAt,
      updatedAt: meetings.updatedAt,
      creatorId: users.id,
      creatorFullName: users.fullName,
      creatorEmail: users.email,
      creatorAvatarUrl: users.avatarUrl,
    })
    .from(meetings)
    .leftJoin(users, eq(meetings.createdBy, users.id))
    .where(and(eq(meetings.leadId, leadId), isNull(meetings.deletedAt)))
    .orderBy(desc(meetings.startsAt))

  return rows.map(row => ({
    id: row.id,
    leadId: row.leadId,
    clientId: row.clientId,
    title: row.title,
    description: row.description,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    meetLink: row.meetLink,
    calendarEventId: row.calendarEventId,
    attendeeEmails: row.attendeeEmails,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creator: row.creatorId
      ? {
          id: row.creatorId,
          fullName: row.creatorFullName,
          email: row.creatorEmail,
          avatarUrl: row.creatorAvatarUrl,
        }
      : null,
  }))
}

/**
 * Fetch a single meeting by ID.
 */
export async function fetchMeetingById(
  meetingId: string
): Promise<Meeting | null> {
  const [row] = await db
    .select({
      id: meetings.id,
      leadId: meetings.leadId,
      clientId: meetings.clientId,
      title: meetings.title,
      description: meetings.description,
      status: meetings.status,
      startsAt: meetings.startsAt,
      endsAt: meetings.endsAt,
      meetLink: meetings.meetLink,
      calendarEventId: meetings.calendarEventId,
      attendeeEmails: meetings.attendeeEmails,
      createdBy: meetings.createdBy,
      createdAt: meetings.createdAt,
      updatedAt: meetings.updatedAt,
    })
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), isNull(meetings.deletedAt)))
    .limit(1)

  return row ?? null
}

export type CreateMeetingInput = {
  leadId?: string | null
  clientId?: string | null
  title: string
  description?: string | null
  status?: MeetingStatus
  startsAt: string
  endsAt: string
  meetLink?: string | null
  calendarEventId?: string | null
  attendeeEmails?: string[]
  createdBy: string
}

/**
 * Create a new meeting.
 */
export async function createMeeting(
  input: CreateMeetingInput
): Promise<Meeting> {
  const timestamp = new Date().toISOString()

  const [inserted] = await db
    .insert(meetings)
    .values({
      leadId: input.leadId ?? null,
      clientId: input.clientId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'SCHEDULED',
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      meetLink: input.meetLink ?? null,
      calendarEventId: input.calendarEventId ?? null,
      attendeeEmails: input.attendeeEmails ?? [],
      createdBy: input.createdBy,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning()

  return {
    id: inserted.id,
    leadId: inserted.leadId,
    clientId: inserted.clientId,
    title: inserted.title,
    description: inserted.description,
    status: inserted.status,
    startsAt: inserted.startsAt,
    endsAt: inserted.endsAt,
    meetLink: inserted.meetLink,
    calendarEventId: inserted.calendarEventId,
    attendeeEmails: inserted.attendeeEmails,
    createdBy: inserted.createdBy,
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  }
}

export type UpdateMeetingInput = {
  title?: string
  description?: string | null
  status?: MeetingStatus
  startsAt?: string
  endsAt?: string
  meetLink?: string | null
  calendarEventId?: string | null
  attendeeEmails?: string[]
}

/**
 * Update an existing meeting.
 */
export async function updateMeeting(
  meetingId: string,
  input: UpdateMeetingInput
): Promise<Meeting | null> {
  const timestamp = new Date().toISOString()

  const [updated] = await db
    .update(meetings)
    .set({
      ...input,
      updatedAt: timestamp,
    })
    .where(and(eq(meetings.id, meetingId), isNull(meetings.deletedAt)))
    .returning()

  if (!updated) {
    return null
  }

  return {
    id: updated.id,
    leadId: updated.leadId,
    clientId: updated.clientId,
    title: updated.title,
    description: updated.description,
    status: updated.status,
    startsAt: updated.startsAt,
    endsAt: updated.endsAt,
    meetLink: updated.meetLink,
    calendarEventId: updated.calendarEventId,
    attendeeEmails: updated.attendeeEmails,
    createdBy: updated.createdBy,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  }
}

/**
 * Soft delete a meeting.
 */
export async function deleteMeeting(meetingId: string): Promise<boolean> {
  const timestamp = new Date().toISOString()

  const [deleted] = await db
    .update(meetings)
    .set({ deletedAt: timestamp, updatedAt: timestamp })
    .where(and(eq(meetings.id, meetingId), isNull(meetings.deletedAt)))
    .returning({ id: meetings.id })

  return Boolean(deleted)
}

/**
 * Find a meeting by its Google Calendar event ID.
 */
export async function findMeetingByCalendarEventId(
  calendarEventId: string
): Promise<Meeting | null> {
  const [row] = await db
    .select({
      id: meetings.id,
      leadId: meetings.leadId,
      clientId: meetings.clientId,
      title: meetings.title,
      description: meetings.description,
      status: meetings.status,
      startsAt: meetings.startsAt,
      endsAt: meetings.endsAt,
      meetLink: meetings.meetLink,
      calendarEventId: meetings.calendarEventId,
      attendeeEmails: meetings.attendeeEmails,
      createdBy: meetings.createdBy,
      createdAt: meetings.createdAt,
      updatedAt: meetings.updatedAt,
    })
    .from(meetings)
    .where(
      and(eq(meetings.calendarEventId, calendarEventId), isNull(meetings.deletedAt))
    )
    .limit(1)

  return row ?? null
}
