import 'server-only'

import { and, gte, isNull, isNotNull, lte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads, leadStageHistory } from '@/lib/db/schema'

export async function fetchVelocityMetrics(start: string, end: string) {
  // Average days to close (from creation to resolvedAt)
  const avgDaysToClose = await db
    .select({
      avgDays: sql<string>`avg(
        EXTRACT(EPOCH FROM (${leads.resolvedAt}::timestamptz - ${leads.createdAt}::timestamptz)) / 86400
      )`,
    })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        isNotNull(leads.resolvedAt),
        gte(leads.resolvedAt, start),
        lte(leads.resolvedAt, end)
      )
    )

  // Time-in-stage breakdown per status
  const timeInStage = await db
    .select({
      toStatus: leadStageHistory.toStatus,
      avgDays: sql<string>`avg(
        EXTRACT(EPOCH FROM (
          COALESCE(
            LEAD(${leadStageHistory.changedAt}) OVER (
              PARTITION BY ${leadStageHistory.leadId}
              ORDER BY ${leadStageHistory.changedAt}
            ),
            NOW()
          ) - ${leadStageHistory.changedAt}::timestamptz
        )) / 86400
      )`,
    })
    .from(leadStageHistory)
    .where(
      and(
        gte(leadStageHistory.changedAt, start),
        lte(leadStageHistory.changedAt, end)
      )
    )
    .groupBy(leadStageHistory.toStatus)

  // Aging leads: open leads sorted by days since currentStageEnteredAt
  const agingLeads = await db
    .select({
      id: leads.id,
      contactName: leads.contactName,
      companyName: leads.companyName,
      status: leads.status,
      currentStageEnteredAt: leads.currentStageEnteredAt,
      estimatedValue: leads.estimatedValue,
      daysInStage: sql<number>`EXTRACT(EPOCH FROM (NOW() - ${leads.currentStageEnteredAt}::timestamptz)) / 86400`,
    })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        isNull(leads.resolvedAt),
        isNotNull(leads.currentStageEnteredAt),
        sql`${leads.status} IN ('NEW_OPPORTUNITIES', 'ACTIVE_OPPORTUNITIES', 'PROPOSAL_SENT', 'ON_ICE')`
      )
    )
    .orderBy(sql`EXTRACT(EPOCH FROM (NOW() - ${leads.currentStageEnteredAt}::timestamptz)) DESC`)
    .limit(20)

  return {
    avgDaysToClose: Number(avgDaysToClose[0]?.avgDays ?? 0),
    timeInStage: timeInStage.map(row => ({
      status: row.toStatus,
      avgDays: Number(row.avgDays ?? 0),
    })),
    agingLeads: agingLeads.map(row => ({
      id: row.id,
      contactName: row.contactName,
      companyName: row.companyName,
      status: row.status,
      currentStageEnteredAt: row.currentStageEnteredAt,
      estimatedValue: Number(row.estimatedValue ?? 0),
      daysInStage: Math.round(Number(row.daysInStage ?? 0)),
    })),
  }
}
