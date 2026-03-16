import 'server-only'

import { and, avg, count, eq, isNull, sql, sum } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'

/**
 * Use COALESCE(resolved_at, updated_at) for date comparisons so leads
 * closed before the resolved_at column was populated are still counted.
 */
const resolvedDate = sql`COALESCE(${leads.resolvedAt}, ${leads.updatedAt})`

export async function fetchRevenueMetrics(start: string, end: string) {
  // Pipeline value: sum estimatedValue for open leads (no date filter)
  const pipelineRows = await db
    .select({
      totalPipeline: sum(leads.estimatedValue),
      weightedPipeline: sql<string>`sum(
        COALESCE(${leads.estimatedValue}, 0) *
        COALESCE(${leads.predictedCloseProbability}, 0)
      )`,
    })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        sql`${leads.status} IN ('NEW_OPPORTUNITIES', 'ACTIVE_OPPORTUNITIES', 'PROPOSAL_SENT', 'ON_ICE')`
      )
    )

  // Won stats, lost count, and monthly revenue - run in parallel
  const [wonStatsResult, lostCountResult, monthlyWon] = await Promise.all([
    db
      .select({
        count: count(),
        total: sum(leads.estimatedValue),
        avg: avg(leads.estimatedValue),
      })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.status, 'CLOSED_WON'),
          sql`${resolvedDate} >= ${start}`,
          sql`${resolvedDate} <= ${end}`
        )
      ),
    db
      .select({ count: count() })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.status, 'CLOSED_LOST'),
          sql`${resolvedDate} >= ${start}`,
          sql`${resolvedDate} <= ${end}`
        )
      ),
    db
      .select({
        month: sql<string>`to_char(${resolvedDate}, 'YYYY-MM')`,
        total: sum(leads.estimatedValue),
        count: count(),
      })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.status, 'CLOSED_WON'),
          sql`${resolvedDate} >= ${start}`,
          sql`${resolvedDate} <= ${end}`
        )
      )
      .groupBy(sql`to_char(${resolvedDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${resolvedDate}, 'YYYY-MM')`),
  ])

  const won = wonStatsResult[0]?.count ?? 0
  const lost = lostCountResult[0]?.count ?? 0
  const totalResolved = won + lost
  const winRate = totalResolved > 0 ? won / totalResolved : 0

  return {
    totalPipeline: Number(pipelineRows[0]?.totalPipeline ?? 0),
    weightedPipeline: Number(pipelineRows[0]?.weightedPipeline ?? 0),
    totalWonRevenue: Number(wonStatsResult[0]?.total ?? 0),
    winRate,
    wonCount: won,
    lostCount: lost,
    avgDealSize: Number(wonStatsResult[0]?.avg ?? 0),
    monthlyWon: monthlyWon.map(row => ({
      month: row.month,
      total: Number(row.total ?? 0),
      count: row.count,
    })),
  }
}
