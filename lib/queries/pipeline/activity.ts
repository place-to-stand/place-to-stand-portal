import 'server-only'

import { and, count, gte, isNull, lte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads, meetings, proposals, threads } from '@/lib/db/schema'

export async function fetchActivityMetrics(start: string, end: string) {
  const [meetingsCount, proposalsCount, threadsCount, newLeadsCount] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(meetings)
        .where(
          and(
            isNull(meetings.deletedAt),
            gte(meetings.startsAt, start),
            lte(meetings.startsAt, end)
          )
        ),
      db
        .select({ count: count() })
        .from(proposals)
        .where(
          and(
            isNull(proposals.deletedAt),
            gte(proposals.sentAt, start),
            lte(proposals.sentAt, end)
          )
        ),
      db
        .select({ count: count() })
        .from(threads)
        .where(
          and(
            isNull(threads.deletedAt),
            gte(threads.createdAt, start),
            lte(threads.createdAt, end)
          )
        ),
      db
        .select({ count: count() })
        .from(leads)
        .where(
          and(
            isNull(leads.deletedAt),
            gte(leads.createdAt, start),
            lte(leads.createdAt, end)
          )
        ),
    ])

  return {
    meetingsScheduled: meetingsCount[0]?.count ?? 0,
    proposalsSent: proposalsCount[0]?.count ?? 0,
    leadsContacted: threadsCount[0]?.count ?? 0,
    newLeads: newLeadsCount[0]?.count ?? 0,
  }
}
