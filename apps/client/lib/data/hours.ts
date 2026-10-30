import { isClientCompany } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import 'server-only'

import { cache } from 'react'
import { and, inArray, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { companies } from '@pts/db/schema'
import {
  clientHoursTotalsFor,
  getClientHoursTotals,
  getNet30MonthlyHours,
  type MonthHours,
} from '@pts/db/hours'
import type { AppUser } from '@/lib/auth/session'
import { resolvePortalScope } from '@/lib/auth/view-as'

/**
 * Prepaid clients draw hours down from purchased blocks; net_30 clients are
 * invoiced for work already performed and have no balance to show.
 */
export type ClientHoursSummary =
  | {
      kind: 'prepaid'
      companyId: string
      clientName: string
      purchased: number
      used: number
      remaining: number
    }
  | {
      kind: 'net_30'
      companyId: string
      clientName: string
    }

/**
 * Hours balance per client in scope.
 *
 * Delegates to `getClientHoursTotals` in `@pts/db/hours` — the same query the
 * internal portal uses — so the client portal can never disagree with what the
 * team sees internally. Remaining can go negative when a client is over their
 * purchased hours.
 *
 * SECURITY: client ids come only from resolvePortalScope — never from a route
 * param, query string, or request body — so there is no IDOR surface here.
 */
export const fetchClientHoursSummaries = cache(
  async (user: AppUser): Promise<ClientHoursSummary[]> => {
    const { companyIds } = await resolvePortalScope(user)
    if (companyIds.length === 0) return []

    const [clientRows, hoursByClient] = await Promise.all([
      db
        .select({
          id: companies.id,
          name: clientNameSql,
          // The billing term in force today (the one place billing type is stored).
          billingType: sql<'prepaid' | 'net_30'>`coalesce((
            select bt.billing_type from billing_terms bt
            where bt.company_id = "companies"."id" and bt.deleted_at is null
              -- The term in force today, like the hours below (not one
              -- scheduled for next month).
              and bt.effective_from <= current_date
            order by bt.effective_from desc limit 1
          ), 'prepaid')`,
        })
        .from(companies)
        .where(and(isClientCompany(), inArray(companies.id, companyIds))),
      getClientHoursTotals(db, companyIds),
    ])

    return clientRows
      .map((client): ClientHoursSummary => {
        if (client.billingType === 'net_30') {
          return {
            kind: 'net_30',
            companyId: client.id,
            clientName: client.name,
          }
        }

        const { purchased, used, remaining } = clientHoursTotalsFor(
          hoursByClient,
          client.id
        )

        return {
          kind: 'prepaid',
          companyId: client.id,
          clientName: client.name,
          purchased,
          used,
          remaining,
        }
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
  }
)

/** A Net 30 client's logged hours: this month, then earlier months. */
export type Net30MonthlyHours = {
  /** This month's start ('yyyy-MM-01', UTC, as the monthly close counts). */
  currentMonth: string
  currentHours: number
  /** Earlier months with hours, newest first. */
  earlierMonths: MonthHours[]
}

/** First day of the current month in UTC, as 'yyyy-MM-01'. */
function currentMonthStartUtc(): string {
  const now = new Date()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${now.getUTCFullYear()}-${month}-01`
}

/**
 * Net 30 hours by month per client in scope, keyed by company id. Reads
 * `getNet30MonthlyHours` in `@pts/db/hours`, which counts a month exactly
 * the way the monthly close bills it, so the portal shows the hours the
 * client is invoiced for. Only meaningful for clients whose summary is
 * net_30; the Hours page reads it for those alone.
 *
 * SECURITY: client ids come only from resolvePortalScope.
 */
export const fetchNet30MonthlyHours = cache(
  async (user: AppUser): Promise<Map<string, Net30MonthlyHours>> => {
    const { companyIds } = await resolvePortalScope(user)
    const byClient = await getNet30MonthlyHours(db, companyIds)
    const currentMonth = currentMonthStartUtc()

    const result = new Map<string, Net30MonthlyHours>()
    for (const companyId of companyIds) {
      const months = byClient.get(companyId) ?? []
      result.set(companyId, {
        currentMonth,
        currentHours:
          months.find(entry => entry.month === currentMonth)?.hours ?? 0,
        earlierMonths: months.filter(entry => entry.month < currentMonth),
      })
    }
    return result
  }
)
