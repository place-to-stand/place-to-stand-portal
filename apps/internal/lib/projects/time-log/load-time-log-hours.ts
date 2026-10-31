'use server'

import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import {
  clientHoursTotalsFor,
  getClientHoursTotals,
  getNet30MonthlyHours,
} from '@pts/db/hours'

import { getCurrentAdmin } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, projects, timeLogs } from '@/lib/db/schema'
import {
  billingTypeAsOfSql,
  currentMonthStartUtc,
  nextMonthStartUtc,
} from '@/lib/queries/clients/billing-terms'
import { getTimeLogSummariesForProjects } from '@/lib/queries/time-logs/aggregates'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The hour info every time-log dialog shows, for one project's client.
 * Prepaid: the project's total hours and the client's balance (hour blocks
 * minus logged hours, `getClientHoursTotals`). Net 30: the project's and the
 * client's hours this month (`getNet30MonthlyHours`, counted the way the
 * monthly close bills them).
 */
export type TimeLogHours = {
  billingType: 'prepaid' | 'net_30'
  clientName: string
  projectName: string
  /** Prepaid: all hours logged on the project. Net 30: this month's. */
  projectHours: number
  /** Prepaid: hours left on the client's blocks (may be negative). */
  clientRemaining: number | null
  /** Net 30: the client's hours logged this month. */
  clientThisMonth: number | null
}

/** Null for internal and personal projects (no client to bill). */
export async function loadTimeLogHours(
  projectId: string
): Promise<TimeLogHours | null> {
  const user = await getCurrentAdmin()
  if (!user || !UUID_PATTERN.test(projectId)) return null

  // One month key for every number: the billing month (UTC), as the close
  // counts it. The billing type is the one in force this month, not a
  // scheduled change.
  const thisMonth = currentMonthStartUtc()
  const [project] = await db
    .select({
      companyId: projects.companyId,
      clientName: companies.name,
      projectName: projects.name,
      billingType: sql<
        'prepaid' | 'net_30'
      >`coalesce(${billingTypeAsOfSql(thisMonth)}, 'prepaid')`,
    })
    .from(projects)
    .innerJoin(companies, eq(companies.id, projects.companyId))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.type, 'CLIENT'),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)
  if (!project?.companyId) return null

  const { companyId, billingType } = project
  const net30 = billingType === 'net_30'
  const [projectSummaries, projectMonth, prepaidTotals, net30Months] =
    await Promise.all([
      net30 ? null : getTimeLogSummariesForProjects([projectId]),
      net30 ? projectHoursInMonth(projectId, thisMonth) : null,
      net30 ? null : getClientHoursTotals(db, [companyId]),
      net30 ? getNet30MonthlyHours(db, [companyId]) : null,
    ])
  const projectSummary = projectSummaries?.get(projectId)

  return {
    billingType,
    clientName: project.clientName,
    projectName: project.projectName,
    projectHours: net30
      ? (projectMonth ?? 0)
      : (projectSummary?.totalHours ?? 0),
    clientRemaining: prepaidTotals
      ? clientHoursTotalsFor(prepaidTotals, companyId).remaining
      : null,
    clientThisMonth: net30Months
      ? (net30Months.get(companyId)?.find(entry => entry.month === thisMonth)
          ?.hours ?? 0)
      : null,
  }
}

/** The project's hours logged in the billing month that starts `month`. */
async function projectHoursInMonth(
  projectId: string,
  month: string
): Promise<number> {
  const [row] = await db
    .select({ hours: sql<string | null>`sum(${timeLogs.hours})` })
    .from(timeLogs)
    .where(
      and(
        eq(timeLogs.projectId, projectId),
        isNull(timeLogs.deletedAt),
        gte(timeLogs.loggedOn, month),
        lt(timeLogs.loggedOn, nextMonthStartUtc())
      )
    )
  return Number(row?.hours ?? 0)
}
