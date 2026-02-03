import 'server-only'

import { and, count, eq, gte, isNull, lte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads, leadStageHistory } from '@/lib/db/schema'

export async function fetchLeadStatusCounts() {
  const rows = await db
    .select({
      status: leads.status,
      count: count(),
    })
    .from(leads)
    .where(isNull(leads.deletedAt))
    .groupBy(leads.status)

  return rows
}

export async function fetchConversionCounts(start: string, end: string) {
  const rows = await db
    .select({
      fromStatus: leadStageHistory.fromStatus,
      toStatus: leadStageHistory.toStatus,
      count: count(),
    })
    .from(leadStageHistory)
    .where(
      and(
        gte(leadStageHistory.changedAt, start),
        lte(leadStageHistory.changedAt, end)
      )
    )
    .groupBy(leadStageHistory.fromStatus, leadStageHistory.toStatus)

  return rows
}
