'use server'

import { and, eq, isNull } from 'drizzle-orm'
import {
  clientHoursTotalsFor,
  getClientHoursTotals,
  getNet30MonthlyHours,
} from '@pts/db/hours'

import { getCurrentAdmin } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, projects } from '@/lib/db/schema'
import {
  currentBillingTypeSql,
  currentMonthStartUtc,
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

  const [project] = await db
    .select({
      companyId: projects.companyId,
      clientName: companies.name,
      billingType: currentBillingTypeSql(),
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
  const [projectSummaries, prepaidTotals, net30Months] = await Promise.all([
    getTimeLogSummariesForProjects([projectId]),
    net30 ? null : getClientHoursTotals(db, [companyId]),
    net30 ? getNet30MonthlyHours(db, [companyId]) : null,
  ])
  const projectSummary = projectSummaries.get(projectId)
  const thisMonth = currentMonthStartUtc()

  return {
    billingType,
    clientName: project.clientName,
    projectHours: net30
      ? (projectSummary?.monthToDateHours ?? 0)
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
