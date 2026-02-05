import 'server-only'

import { and, isNull, isNotNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import type { LeadStatusValue } from '@/lib/leads/constants'

/**
 * Use COALESCE(resolved_at, updated_at) so leads closed before
 * the resolved_at column was populated are still included.
 */
const resolvedDate = sql`COALESCE(${leads.resolvedAt}, ${leads.updatedAt})`

export async function fetchVelocityMetrics(start: string, end: string) {
  // Average days from lead creation to closed-won
  const avgDaysToClose = await db
    .select({
      avgDays: sql<string>`avg(
        EXTRACT(EPOCH FROM (${resolvedDate}::timestamptz - ${leads.createdAt}::timestamptz)) / 86400
      )`,
    })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        sql`${leads.status} = 'CLOSED_WON'`,
        sql`${resolvedDate} >= ${start}`,
        sql`${resolvedDate} <= ${end}`
      )
    )

  // Time-in-stage breakdown per status (use raw SQL for window function in subquery)
  const timeInStageRows = await db.execute(sql`
    SELECT to_status, avg(days_in_stage) AS avg_days
    FROM (
      SELECT
        to_status,
        EXTRACT(EPOCH FROM (
          COALESCE(
            LEAD(changed_at) OVER (PARTITION BY lead_id ORDER BY changed_at),
            NOW()
          ) - changed_at
        )) / 86400 AS days_in_stage
      FROM lead_stage_history
      WHERE changed_at >= ${start} AND changed_at <= ${end}
    ) sub
    GROUP BY to_status
  `)

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
    timeInStage: (timeInStageRows as unknown as Array<{ to_status: string; avg_days: string }>).map(row => ({
      status: row.to_status as LeadStatusValue,
      avgDays: Number(row.avg_days ?? 0),
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
