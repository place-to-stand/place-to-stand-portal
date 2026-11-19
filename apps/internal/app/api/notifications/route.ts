import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { roleCan } from '@/lib/auth/capabilities'
import { getCurrentStaff } from '@/lib/auth/session'
import {
  archiveNotifications,
  fetchNotificationFeed,
  markNotificationsRead,
  markNotificationsUnread,
  restoreNotifications,
} from '@/lib/notifications/in-app/queries'

/**
 * The viewer's notification stream for the home Notifications widget.
 * GET returns the feed; POST changes read/archived state for some (`ids`) or
 * all of the viewer's notifications. Everything is scoped to the viewer.
 */
const querySchema = z.object({
  filter: z.enum(['all', 'unread', 'archived']).default('all'),
  // A cursor from the previous page: "<timestamp>_<uuid>".
  before: z
    .string()
    .regex(
      /^[0-9T:.Z+\- ]{10,40}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
    // A well-formed but impossible time is a bad request, not a crash.
    .refine(cursor => !Number.isNaN(Date.parse(cursor.split('_')[0] ?? '')))
    .optional(),
})

const actionSchema = z.object({
  action: z.enum(['read', 'unread', 'archive', 'restore']),
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
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  )
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid filter.' },
      { status: 400 }
    )
  }

  try {
    const feed = await fetchNotificationFeed(
      user,
      parsed.data.filter,
      parsed.data.before
    )
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
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request.' },
      { status: 400 }
    )
  }

  const { action, ids } = parsed.data
  // Only "read" may mean every notification; the others name their rows, so
  // a stray request can't archive the whole feed.
  if (action !== 'read' && !ids?.length) {
    return NextResponse.json(
      { ok: false, error: 'Pick notifications first.' },
      { status: 400 }
    )
  }

  try {
    if (action === 'read') await markNotificationsRead(user.id, ids)
    if (action === 'unread') await markNotificationsUnread(user.id, ids ?? [])
    if (action === 'archive') await archiveNotifications(user.id, ids ?? [])
    if (action === 'restore') await restoreNotifications(user.id, ids ?? [])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to update notifications', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to update notifications.' },
      { status: 500 }
    )
  }
}
