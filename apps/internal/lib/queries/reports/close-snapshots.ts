import { clientNameSql, personNameSql } from '@pts/db/names'
import 'server-only'

import { and, eq, gt, gte, isNull, lte, or, sql } from 'drizzle-orm'

import { db, type DbTx } from '@/lib/db'
import { companies,
  hourBlocks,
  monthlyCloseSnapshots,
  projects,
  timeLogs,
  users,
} from '@/lib/db/schema'

type DbOrTransaction = typeof db | DbTx

export type SnapshotRow = {
  id: string
  year: number
  month: number
  report: unknown
  closedAt: string
  closedBy: string | null
  closedByName: string | null
}

export async function getActiveSnapshot(
  year: number,
  month: number
): Promise<SnapshotRow | null> {
  const [row] = await db
    .select({
      id: monthlyCloseSnapshots.id,
      year: monthlyCloseSnapshots.year,
      month: monthlyCloseSnapshots.month,
      report: monthlyCloseSnapshots.report,
      closedAt: monthlyCloseSnapshots.closedAt,
      closedBy: monthlyCloseSnapshots.closedBy,
      closedByName: personNameSql,
    })
    .from(monthlyCloseSnapshots)
    .leftJoin(users, eq(monthlyCloseSnapshots.closedBy, users.id))
    .where(
      and(
        eq(monthlyCloseSnapshots.year, year),
        eq(monthlyCloseSnapshots.month, month),
        isNull(monthlyCloseSnapshots.deletedAt)
      )
    )
    .limit(1)

  return row ?? null
}

/**
 * Inserts the active snapshot for a period. `closedAt` is the cutoff captured
 * BEFORE report derivation. Throws on the partial unique index if the period
 * is already closed (callers translate code 23505 to "already closed").
 */
export async function insertSnapshot(
  tx: DbOrTransaction,
  params: {
    year: number
    month: number
    report: unknown
    closedAt: string
    closedBy: string
  }
): Promise<string | null> {
  const [inserted] = await tx
    .insert(monthlyCloseSnapshots)
    .values({
      year: params.year,
      month: params.month,
      report: params.report,
      closedAt: params.closedAt,
      closedBy: params.closedBy,
    })
    .returning({ id: monthlyCloseSnapshots.id })

  return inserted?.id ?? null
}

/** Soft-deletes the active snapshot; returns the row id, or null if none. */
export async function softDeleteSnapshot(
  tx: DbOrTransaction,
  year: number,
  month: number
): Promise<string | null> {
  const [updated] = await tx
    .update(monthlyCloseSnapshots)
    .set({
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(monthlyCloseSnapshots.year, year),
        eq(monthlyCloseSnapshots.month, month),
        isNull(monthlyCloseSnapshots.deletedAt)
      )
    )
    .returning({ id: monthlyCloseSnapshots.id })

  return updated?.id ?? null
}

/**
 * Replaces the payload of an active snapshot in place, keeping its close
 * cutoff and author. Only for additions that don't change what was frozen
 * (the profit share added to a month closed before the policy existed).
 */
export async function updateSnapshotReport(
  id: string,
  report: unknown
): Promise<boolean> {
  const [updated] = await db
    .update(monthlyCloseSnapshots)
    .set({ report, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(monthlyCloseSnapshots.id, id),
        isNull(monthlyCloseSnapshots.deletedAt)
      )
    )
    .returning({ id: monthlyCloseSnapshots.id })

  return Boolean(updated)
}

export type LateRecordRow = {
  kind: 'time_log' | 'hour_block'
  id: string
  clientName: string | null
  hours: string
  eventDate: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/**
 * Records whose event time places them inside the closed month but whose
 * record time (created/updated/deleted) postdates the close cutoff — the
 * attribution list for the drift banner. Deliberately does NOT filter
 * deleted_at IS NULL: soft-deleted-after-close records ARE late changes.
 */
export async function fetchLateRecords(
  monthStart: string,
  monthEnd: string,
  closedAt: string
): Promise<LateRecordRow[]> {
  const [lateTimeLogs, lateHourBlocks] = await Promise.all([
    db
      .select({
        id: timeLogs.id,
        clientName: clientNameSql,
        hours: timeLogs.hours,
        eventDate: timeLogs.loggedOn,
        createdAt: timeLogs.createdAt,
        updatedAt: timeLogs.updatedAt,
        deletedAt: timeLogs.deletedAt,
      })
      .from(timeLogs)
      .innerJoin(projects, eq(timeLogs.projectId, projects.id))
      .leftJoin(companies, eq(projects.companyId, companies.id))
      .where(
        and(
          gte(timeLogs.loggedOn, monthStart),
          lte(timeLogs.loggedOn, monthEnd),
          or(
            gt(timeLogs.createdAt, closedAt),
            gt(timeLogs.updatedAt, closedAt),
            gt(timeLogs.deletedAt, closedAt)
          )
        )
      ),
    db
      .select({
        id: hourBlocks.id,
        clientName: clientNameSql,
        hours: hourBlocks.hoursPurchased,
        eventDate: hourBlocks.billingMonth,
        createdAt: hourBlocks.createdAt,
        updatedAt: hourBlocks.updatedAt,
        deletedAt: hourBlocks.deletedAt,
      })
      .from(hourBlocks)
      .innerJoin(companies, eq(hourBlocks.companyId, companies.id))
      .where(
        and(
          gte(hourBlocks.billingMonth, monthStart),
          lte(hourBlocks.billingMonth, monthEnd),
          or(
            gt(hourBlocks.createdAt, closedAt),
            gt(hourBlocks.updatedAt, closedAt),
            gt(hourBlocks.deletedAt, closedAt)
          )
        )
      ),
  ])

  return [
    ...lateTimeLogs.map(row => ({ ...row, kind: 'time_log' as const })),
    ...lateHourBlocks.map(row => ({ ...row, kind: 'hour_block' as const })),
  ]
}

/** True when the month containing `date` ('yyyy-MM-dd') has an active close. */
export async function hasActiveSnapshotForDate(date: string): Promise<boolean> {
  const [row] = await db
    .select({ exists: sql<number>`1` })
    .from(monthlyCloseSnapshots)
    .where(
      and(
        eq(
          monthlyCloseSnapshots.year,
          sql`EXTRACT(YEAR FROM ${date}::date)::int`
        ),
        eq(
          monthlyCloseSnapshots.month,
          sql`EXTRACT(MONTH FROM ${date}::date)::int`
        ),
        isNull(monthlyCloseSnapshots.deletedAt)
      )
    )
    .limit(1)

  return Boolean(row)
}

/** Every month with an active close, as month starts ('yyyy-MM-01'). */
export async function listClosedMonthStarts(): Promise<string[]> {
  const rows = await db
    .select({
      year: monthlyCloseSnapshots.year,
      month: monthlyCloseSnapshots.month,
    })
    .from(monthlyCloseSnapshots)
    .where(isNull(monthlyCloseSnapshots.deletedAt))
  return rows.map(
    row => `${row.year}-${String(row.month).padStart(2, '0')}-01`
  )
}
