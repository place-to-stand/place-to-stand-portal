import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { transcripts } from '@/lib/db/schema'

/**
 * POST /api/transcripts/batch — Batch operations on transcripts
 *
 * Actions:
 * - { ids: string[], action: 'dismiss' } — Dismiss multiple transcripts
 * - { action: 'dismiss_before', before: string } — Dismiss all unclassified before date
 */
export async function POST(request: NextRequest) {
  const user = await requireUser()

  const body = await request.json()
  const { action } = body
  const now = new Date().toISOString()

  if (action === 'dismiss' && Array.isArray(body.ids) && body.ids.length > 0) {
    const result = await db
      .update(transcripts)
      .set({
        classification: 'DISMISSED',
        clientId: null,
        projectId: null,
        leadId: null,
        classifiedBy: user.id,
        classifiedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          inArray(transcripts.id, body.ids),
          isNull(transcripts.deletedAt)
        )
      )
      .returning({ id: transcripts.id })

    return NextResponse.json({ ok: true, dismissed: result.length })
  }

  if (action === 'dismiss_before' && body.before) {
    const result = await db
      .update(transcripts)
      .set({
        classification: 'DISMISSED',
        clientId: null,
        projectId: null,
        leadId: null,
        classifiedBy: user.id,
        classifiedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(transcripts.classification, 'UNCLASSIFIED'),
          isNull(transcripts.deletedAt),
          sql`COALESCE(${transcripts.meetingDate}, ${transcripts.createdAt}) < ${body.before}`
        )
      )
      .returning({ id: transcripts.id })

    return NextResponse.json({ ok: true, dismissed: result.length })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
