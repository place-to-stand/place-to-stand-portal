import 'server-only'

import { currentBillingTypeSql } from '@pts/db/terms'
import { wasClientCompany } from '@pts/db/client-state'
import { clientHoursTotalsFor, getClientHoursTotals } from '@pts/db/hours'
import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, projects, timeLogs } from '@/lib/db/schema'
import { fetchProjectsForClient, type ClientProject } from '@/lib/data/clients'
import { NotFoundError } from '@/lib/errors/http'
import { getCompanyDetail } from '@/lib/queries/companies'
import {
  currentMonthStartUtc,
  nextMonthStartUtc,
} from '@/lib/queries/companies/billing/billing-terms'
import { UUID_PATTERN } from '@/lib/sheets/entities'

import type { CompanyDetail } from './types'

/*
 * Reads behind the company sheet, served by GET routes under
 * /api/companies/[companyId]/ (see `lib/http/get-json.ts` for why not server
 * actions). Callers check the role; these take the signed-in user.
 */

export type CompanySheetData = {
  company: CompanyDetail | null
}

/** Everything the company sheet needs; `null` id = create mode. */
export async function loadCompanySheet(
  user: AppUser,
  companyId: string | null
): Promise<CompanySheetData | null> {
  if (!companyId) return { company: null }
  if (!UUID_PATTERN.test(companyId)) return null

  try {
    return { company: await getCompanyDetail(user, companyId) }
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }
}

export type CompanyClientWork = {
  clientSlug: string | null
  projects: ClientProject[]
  /** Prepaid hours for the current era; null for net 30. */
  hours: { purchased: number; used: number; remaining: number } | null
  /**
   * Net 30: hours logged on its client projects this month, which a stop
   * before this month would leave unbilled. Null for prepaid (blocks count
   * in the month bought, billed or not).
   */
  hoursLoggedThisMonth: number | null
}

/** A client company's work for its Client column (admins). */
export async function loadCompanyClientWork(
  user: AppUser,
  companyId: string
): Promise<CompanyClientWork | null> {
  if (!UUID_PATTERN.test(companyId)) return null

  const [client] = await db
    .select({ slug: companies.slug, billingType: currentBillingTypeSql() })
    .from(companies)
    .where(
      // Former clients too: their Projects keep the history.
      and(wasClientCompany(), eq(companies.id, companyId))
    )
    .limit(1)
  if (!client) return null

  const net30 = client.billingType === 'net_30'
  const [projectRows, totals, loggedThisMonth] = await Promise.all([
    fetchProjectsForClient(user, companyId),
    getClientHoursTotals(db, [companyId]),
    net30 ? sumHoursLoggedThisMonth(companyId) : null,
  ])
  const balance = clientHoursTotalsFor(totals, companyId)

  return {
    clientSlug: client.slug,
    projects: projectRows,
    hours:
      client.billingType === 'prepaid'
        ? {
            purchased: balance.purchased,
            used: balance.used,
            remaining: balance.remaining,
          }
        : null,
    hoursLoggedThisMonth: loggedThisMonth,
  }
}

/** Hours logged this month (UTC) on a company's client projects. */
async function sumHoursLoggedThisMonth(companyId: string): Promise<number> {
  const [row] = await db
    .select({ hours: sql<string | null>`sum(${timeLogs.hours})` })
    .from(timeLogs)
    .innerJoin(projects, eq(projects.id, timeLogs.projectId))
    .where(
      and(
        eq(projects.companyId, companyId),
        eq(projects.type, 'CLIENT'),
        isNull(projects.deletedAt),
        isNull(timeLogs.deletedAt),
        gte(timeLogs.loggedOn, currentMonthStartUtc()),
        lt(timeLogs.loggedOn, nextMonthStartUtc())
      )
    )
  const hours = Number(row?.hours ?? 0)
  return Number.isFinite(hours) ? hours : 0
}
