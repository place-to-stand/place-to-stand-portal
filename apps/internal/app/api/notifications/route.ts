import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { roleCan } from '@/lib/auth/capabilities'
import { getCurrentStaff } from '@/lib/auth/session'
import {
  clearNotifications,
  fetchNotificationFeed,
  markNotificationsRead,
  markNotificationsUnread,
} from '@/lib/notifications/in-app/queries'

/**
 * The viewer's notification stream for the home Notifications widget.
 * GET returns the feed; POST changes read/cleared state for some (`ids`) or
 * all of the viewer's notifications. Everything is scoped to the viewer.
 */
const querySchema = z.object({
  filter: z.enum(['all', 'unread']).default('all'),
})

const actionSchema = z.object({
  action: z.enum(['read', 'unread', 'clear']),
  ids: z.array(z.string().uuid()).max(200).optional(),
})

async function requireViewer() {
  const user = await getCurrentStaff()
  if (!user || !roleCan(user.role, 'widget.notifications')) return null
  return user
}

export async function GET(request: NextRequest) {
  const user = await requireViewer()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid filter.' }, { status: 400 })
  }

  try {
    const feed = await fetchNotificationFeed(user, parsed.data.filter)
    return NextResponse.json({ ok: true, data: feed })
  } catch (error) {
    console.error('Failed to load notifications', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to load notifications.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await requireViewer()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const { action, ids } = parsed.data
  if (action === 'unread' && !ids?.length) {
    return NextResponse.json(
      { ok: false, error: 'Pick notifications to mark unread.' },
      { status: 400 }
    )
  }

  try {
    if (action === 'read') await markNotificationsRead(user.id, ids)
    if (action === 'unread') await markNotificationsUnread(user.id, ids ?? [])
    if (action === 'clear') await clearNotifications(user.id, ids)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to update notifications', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to update notifications.' },
      { status: 500 }
    )
  }
}
