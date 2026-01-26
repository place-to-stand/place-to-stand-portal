import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { threads } from '@/lib/db/schema'
import { toResponsePayload, NotFoundError, ForbiddenError, type HttpError } from '@/lib/errors/http'
import { matchThreadToLead } from '@/lib/email/matcher'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  const user = await requireUser()
  const { threadId } = await params

  try {
    // Get the thread
    const [thread] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
      .limit(1)

    if (!thread) throw new NotFoundError('Thread not found')

    if (!isAdmin(user) && thread.createdBy !== user.id) {
      throw new ForbiddenError('Access denied')
    }

    // If thread already has a lead, return empty suggestions
    if (thread.leadId) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    // Use participant emails from thread to find matching leads
    const participantEmails = thread.participantEmails ?? []
    if (participantEmails.length === 0) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    // Use existing matcher to find lead by email
    const leadMatch = await matchThreadToLead(participantEmails)

    if (!leadMatch) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    // Return the matching lead as a suggestion
    const suggestions = [
      {
        leadId: leadMatch.leadId,
        contactName: leadMatch.contactName,
        contactEmail: leadMatch.contactEmail,
        confidence: leadMatch.confidence === 'HIGH' ? 1.0 : 0.7,
        matchType: 'EXACT_EMAIL',
        reasoning: `Email address ${leadMatch.contactEmail} matches this lead`,
      },
    ]

    return NextResponse.json({ ok: true, suggestions })
  } catch (err) {
    const error = err as HttpError
    console.error('Thread lead suggestions error:', error)
    const { status, body } = toResponsePayload(error)
    return NextResponse.json(body, { status })
  }
}
