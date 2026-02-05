'use server'

import { and, isNull, sql } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { performLeadScoring } from '@/lib/leads/scoring'

export type RescoreResult = {
  success: boolean
  total: number
  scored: number
  skipped: number
  failed: number
  errors: string[]
}

const CONCURRENCY = 3

/**
 * Re-score all non-deleted leads with force=true.
 * Processes in batches with limited concurrency to avoid API rate limits.
 */
export async function rescoreAllLeads(): Promise<RescoreResult> {
  await requireRole('ADMIN')

  const allLeads = await db
    .select({ id: leads.id, contactName: leads.contactName })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        sql`${leads.status} IN ('NEW_OPPORTUNITIES', 'ACTIVE_OPPORTUNITIES', 'PROPOSAL_SENT', 'ON_ICE', 'CLOSED_WON')`
      )
    )

  const result: RescoreResult = {
    success: true,
    total: allLeads.length,
    scored: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < allLeads.length; i += CONCURRENCY) {
    const chunk = allLeads.slice(i, i + CONCURRENCY)

    const outcomes = await Promise.allSettled(
      chunk.map(lead => performLeadScoring(lead.id, true))
    )

    for (let j = 0; j < outcomes.length; j++) {
      const outcome = outcomes[j]
      const lead = chunk[j]

      if (outcome.status === 'rejected') {
        result.failed++
        result.errors.push(`${lead.contactName}: ${outcome.reason}`)
      } else if (!outcome.value.success) {
        result.failed++
        result.errors.push(`${lead.contactName}: ${outcome.value.error}`)
      } else if (outcome.value.scored) {
        result.scored++
      } else {
        result.skipped++
      }
    }
  }

  return result
}
