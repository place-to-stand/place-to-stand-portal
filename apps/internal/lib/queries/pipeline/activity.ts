import 'server-only'

import { and, count, gte, isNull, lte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'

export async function fetchActivityMetrics(start: string, end: string) {
  // TODO: meetingsScheduled / proposalsSent / leadsContacted previously came
  // from the meetings, proposals, threads and messages tables, which have been
  // removed. Only the newLeads metric remains.
  const newLeadsCount = await db
    .select({ count: count() })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        gte(leads.createdAt, start),
        lte(leads.createdAt, end)
      )
    )

  return {
    newLeads: newLeadsCount[0]?.count ?? 0,
  }
}
