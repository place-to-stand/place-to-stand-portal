import { NextRequest, NextResponse } from 'next/server'
import { and, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { performLeadScoring } from '@/lib/leads/scoring'

const CONCURRENCY = 3

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allLeads = await db
    .select({ id: leads.id, contactName: leads.contactName })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        sql`${leads.status} IN ('NEW_OPPORTUNITIES', 'ACTIVE_OPPORTUNITIES', 'PROPOSAL_SENT', 'ON_ICE', 'CLOSED_WON')`
      )
    )

  let scored = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < allLeads.length; i += CONCURRENCY) {
    const chunk = allLeads.slice(i, i + CONCURRENCY)

    const outcomes = await Promise.allSettled(
      chunk.map(lead => performLeadScoring(lead.id))
    )

    for (let j = 0; j < outcomes.length; j++) {
      const outcome = outcomes[j]
      const lead = chunk[j]

      if (outcome.status === 'rejected') {
        failed++
        errors.push(`${lead.contactName}: ${outcome.reason}`)
      } else if (!outcome.value.success) {
        failed++
        errors.push(`${lead.contactName}: ${outcome.value.error}`)
      } else if (outcome.value.scored) {
        scored++
      } else {
        skipped++
      }
    }
  }

  return NextResponse.json({
    total: allLeads.length,
    scored,
    skipped,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  })
}
