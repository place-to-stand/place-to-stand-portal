import 'server-only'

import { cache } from 'react'

import { companyMonthEndCutoff } from '@pts/ui/dates'

import {
  PROFIT_SHARE_POLICY,
  computeProfitShare,
  type ProfitShareData,
  type ProfitSharePartner,
} from '@/lib/billing/profit-share'
import { serverEnv } from '@/lib/env.server'
import {
  MercuryApiError,
  fetchMercuryBalanceAt,
  type MercuryBalanceAt,
} from '@/lib/integrations/mercury/api'
import { fetchUsersByEmail } from '@/lib/queries/reports/profit-share-partners'

/**
 * The instant a month ends in the company time zone (see
 * companyMonthEndCutoff in @pts/ui/dates).
 */
export function monthEndCutoff(year: number, month: number): Date {
  return companyMonthEndCutoff(year, month)
}

function lastDayOfMonth(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export type MonthEndBalanceResult =
  | { ok: true; value: MercuryBalanceAt; monthComplete: boolean }
  | { ok: false; reason: 'not_configured' | 'error'; message: string }

function describeMercuryError(error: unknown): string {
  if (error instanceof MercuryApiError) {
    if (error.status === 401 || error.status === 403) {
      return `Mercury rejected the API token (${error.status}).`
    }
    return `${error.message}.`
  }
  return 'Mercury could not be reached.'
}

/**
 * The combined Mercury balance at the end of the month, or today's balance
 * while the month is still running. Deduped per request.
 */
export const loadMonthEndBalance = cache(
  async (year: number, month: number): Promise<MonthEndBalanceResult> => {
    const token = serverEnv.MERCURY_API_TOKEN
    if (!token) {
      return {
        ok: false,
        reason: 'not_configured',
        message: 'MERCURY_API_TOKEN is not set.',
      }
    }

    const cutoff = monthEndCutoff(year, month)
    const monthComplete = cutoff.getTime() <= Date.now()

    try {
      const value = await fetchMercuryBalanceAt(
        token,
        monthComplete ? cutoff : new Date()
      )
      return { ok: true, value, monthComplete }
    } catch (error) {
      console.error('Failed to load Mercury balance', error)
      return {
        ok: false,
        reason: 'error',
        message: describeMercuryError(error),
      }
    }
  }
)

/** The profit-share partners as users, in policy order. */
export const fetchProfitSharePartners = cache(
  async (): Promise<Array<Omit<ProfitSharePartner, 'amount'>>> => {
    const rows = await fetchUsersByEmail(PROFIT_SHARE_POLICY.partnerEmails)
    const byEmail = new Map(rows.map(row => [row.email.toLowerCase(), row]))

    return PROFIT_SHARE_POLICY.partnerEmails.flatMap(email => {
      const row = byEmail.get(email)
      if (!row) return []
      return [
        {
          userId: row.id,
          name: row.fullName ?? row.email,
          email: row.email,
          avatarUpdatedAt: row.avatarUrl ? row.updatedAt : null,
        },
      ]
    })
  }
)

/** Assembles the profit share for a month from a loaded balance. */
export async function buildProfitShare(params: {
  year: number
  month: number
  balance: Extract<MonthEndBalanceResult, { ok: true }>
  payouts: number
  addedAfterCloseAt?: string | null
}): Promise<ProfitShareData> {
  const partners = await fetchProfitSharePartners()
  return computeProfitShare({
    asOfDate: lastDayOfMonth(params.year, params.month),
    monthComplete: params.balance.monthComplete,
    balance: params.balance.value.balance,
    accounts: params.balance.value.accounts,
    fetchedAt: params.balance.value.fetchedAt,
    addedAfterCloseAt: params.addedAfterCloseAt,
    payouts: params.payouts,
    partners,
  })
}
