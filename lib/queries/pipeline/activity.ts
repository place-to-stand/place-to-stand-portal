import 'server-only'

import { and, count, countDistinct, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads, meetings, messages, proposals, threads } from '@/lib/db/schema'

export async function fetchActivityMetrics(start: string, end: string) {
  const [meetingsCount, proposalsCount, leadsContactedCount, newLeadsCount] =
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
      // Distinct leads that had a message sent in the period
      db
        .select({ count: countDistinct(threads.leadId) })
        .from(messages)
        .innerJoin(threads, and(
          eq(messages.threadId, threads.id),
          isNull(threads.deletedAt),
          isNotNull(threads.leadId),
        ))
        .where(
          and(
            isNull(messages.deletedAt),
            gte(messages.sentAt, start),
            lte(messages.sentAt, end),
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
    leadsContacted: leadsContactedCount[0]?.count ?? 0,
    newLeads: newLeadsCount[0]?.count ?? 0,
  }
}
