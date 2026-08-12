import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import {
  fetchHoursSnapshot,
  fetchMyMonthTimeLogs,
} from '@/lib/data/dashboard/hours'

const schema = z.object({
  year: z.number().int().min(2000).max(3000),
  month: z.number().int().min(1).max(12),
  // Present only when the widget is paging further into the log list. Absent
  // means "give me the whole snapshot", which already carries page zero.
  logOffset: z.number().int().min(0).max(10_000).optional(),
})

export async function POST(request: Request) {
  const user = await requireUser()

  let payload: z.infer<typeof schema>
  try {
    payload = schema.parse(await request.json())
  } catch (error) {
    console.error('Invalid payload for hours snapshot', error)
    return NextResponse.json(
      { error: 'Invalid request payload.' },
      { status: 400 }
    )
  }

  if (payload.logOffset !== undefined) {
    try {
      const page = await fetchMyMonthTimeLogs(user, payload, {
        offset: payload.logOffset,
      })
      return NextResponse.json(page)
    } catch (error) {
      console.error('Failed to load time log page', error)
      return NextResponse.json(
        { error: 'Unable to load more time logs right now.' },
        { status: 500 }
      )
    }
  }

  try {
    const snapshot = await fetchHoursSnapshot(user, payload)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('Failed to load hours snapshot', error)
    return NextResponse.json(
      { error: 'Unable to load hours summary right now.' },
      { status: 500 }
    )
  }
}
