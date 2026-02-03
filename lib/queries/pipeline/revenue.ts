import 'server-only'

import { and, avg, count, eq, gte, isNull, lte, sql, sum } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { isOpenLeadStatus } from '@/lib/leads/constants'

export async function fetchRevenueMetrics(start: string, end: string) {
  // Pipeline value: sum estimatedValue for open leads
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

  // Win rate, avg deal size, and monthly revenue - run in parallel for performance
  const [wonCountResult, lostCountResult, avgDealSizeResult, monthlyWon] = await Promise.all([
    db
      .select({ count: count() })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.status, 'CLOSED_WON'),
          gte(leads.resolvedAt, start),
          lte(leads.resolvedAt, end)
        )
      ),
    db
      .select({ count: count() })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.status, 'CLOSED_LOST'),
          gte(leads.resolvedAt, start),
          lte(leads.resolvedAt, end)
        )
      ),
    db
      .select({ avg: avg(leads.estimatedValue) })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.status, 'CLOSED_WON'),
          gte(leads.resolvedAt, start),
          lte(leads.resolvedAt, end)
        )
      ),
    db
    .select({
      month: sql<string>`to_char(${leads.resolvedAt}, 'YYYY-MM')`,
      total: sum(leads.estimatedValue),
      count: count(),
    })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        eq(leads.status, 'CLOSED_WON'),
        gte(leads.resolvedAt, start),
        lte(leads.resolvedAt, end)
      )
    )
    .groupBy(sql`to_char(${leads.resolvedAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${leads.resolvedAt}, 'YYYY-MM')`),
  ])

  const won = wonCountResult[0]?.count ?? 0
  const lost = lostCountResult[0]?.count ?? 0
  const totalResolved = won + lost
  const winRate = totalResolved > 0 ? won / totalResolved : 0

  return {
    totalPipeline: Number(pipelineRows[0]?.totalPipeline ?? 0),
    weightedPipeline: Number(pipelineRows[0]?.weightedPipeline ?? 0),
    winRate,
    wonCount: won,
    lostCount: lost,
    avgDealSize: Number(avgDealSizeResult[0]?.avg ?? 0),
    monthlyWon: monthlyWon.map(row => ({
      month: row.month,
      total: Number(row.total ?? 0),
      count: row.count,
    })),
  }
}
