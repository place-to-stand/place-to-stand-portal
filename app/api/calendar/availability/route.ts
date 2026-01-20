import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { getFreeBusy } from '@/lib/google/calendar'
import { hasCalendarScopes } from '@/lib/oauth/google'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

const querySchema = z.object({
  timeMin: z.string().datetime(),
  timeMax: z.string().datetime(),
  timeZone: z.string().optional(),
})

/**
 * GET /api/calendar/availability
 *
 * Query Google Calendar free/busy times for scheduling.
 * Returns busy time slots within the specified range.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser()
  assertAdmin(user)

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams
  const rawParams = {
    timeMin: searchParams.get('timeMin'),
    timeMax: searchParams.get('timeMax'),
    timeZone: searchParams.get('timeZone'),
  }

  const parsed = querySchema.safeParse(rawParams)

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid parameters' },
      { status: 400 }
    )
  }

  const { timeMin, timeMax, timeZone } = parsed.data

  // Check if user has Google connection with Calendar scopes
  const [connection] = await db
    .select({
      id: oauthConnections.id,
      scopes: oauthConnections.scopes,
    })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, user.id),
        eq(oauthConnections.provider, 'GOOGLE'),
        isNull(oauthConnections.deletedAt)
      )
    )
    .limit(1)

  if (!connection) {
    return NextResponse.json(
      { ok: false, error: 'Google account not connected', requiresConnection: true },
      { status: 400 }
    )
  }

  if (!hasCalendarScopes(connection.scopes)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Calendar access not granted. Please reconnect your Google account.',
        requiresReauth: true,
      },
      { status: 400 }
    )
  }

  try {
    const freeBusy = await getFreeBusy(user.id, {
      timeMin,
      timeMax,
      timeZone: timeZone ?? 'America/Los_Angeles',
    })

    // Extract busy times from primary calendar
    const primaryBusy = freeBusy.calendars?.primary?.busy ?? []

    return NextResponse.json({
      ok: true,
      timeMin: freeBusy.timeMin,
      timeMax: freeBusy.timeMax,
      busySlots: primaryBusy,
    })
  } catch (error) {
    console.error('Failed to get calendar availability', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to fetch availability',
      },
      { status: 500 }
    )
  }
}
