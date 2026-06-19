import 'server-only'

import { and, count, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'

/**
 * Use COALESCE(resolved_at, updated_at) for date comparisons so leads
 * closed before the resolved_at column was populated are still counted.
 */
const resolvedDate = sql`COALESCE(${leads.resolvedAt}, ${leads.updatedAt})`

export async function fetchRevenueMetrics(start: string, end: string) {
  // TODO: Revenue/value metrics previously derived from leads.estimatedValue
  // and leads.predictedCloseProbability, which have been removed. Win/loss
  // counts and win rate remain available; monetary metrics return 0/empty.

  // Won count, lost count, and monthly won counts - run in parallel
  const [wonStatsResult, lostCountResult, monthlyWon] = await Promise.all([
    db
      .select({
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
    // TODO: monetary pipeline metrics removed with estimatedValue column
    totalPipeline: 0,
    weightedPipeline: 0,
    totalWonRevenue: 0,
    winRate,
    wonCount: won,
    lostCount: lost,
    avgDealSize: 0,
    monthlyWon: monthlyWon.map(row => ({
      month: row.month,
      total: 0,
      count: row.count,
    })),
  }
}
