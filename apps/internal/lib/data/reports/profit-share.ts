import 'server-only'

import { cache } from 'react'

import { readProfitSharePolicy, type ProfitSharePolicy } from '@pts/db/business'
import { companyMonthEndCutoff } from '@pts/ui/dates'

import {
  profitShareAppliesTo,
  computeProfitShare,
  type ProfitShareData,
  type ProfitSharePartner,
} from '@/lib/billing/profit-share'
import { getBusinessIdentity } from '@/lib/business/identity'
import { db } from '@/lib/db'
import { serverEnv } from '@/lib/env.server'
import {
  MercuryApiError,
  fetchMercuryBalanceAt,
  type MercuryBalanceAt,
} from '@/lib/integrations/mercury/api'
import { fetchUsersByIds } from '@/lib/queries/reports/profit-share-partners'

/**
 * The instant a month ends for the profit share: midnight in the Business
 * time zone (Settings → Business; see companyMonthEndCutoff in @pts/ui/dates).
 * Closed months keep the profit share frozen in their snapshot, even if the
 * zone changes later.
 */
function monthEndCutoff(year: number, month: number): Date {
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

    // Read the Business time zone first: this can run before the root
    // layout has loaded it.
    await getBusinessIdentity()
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

/** The profit share set on Settings → Billing, or null while it is off. */
export const getProfitSharePolicy = cache(
  (): Promise<ProfitSharePolicy | null> => readProfitSharePolicy(db)
)

/** True when the month's profit share is set up and has started. */
export async function profitShareApplies(
  year: number,
  month: number
): Promise<boolean> {
  return profitShareAppliesTo(await getProfitSharePolicy(), year, month)
}

/** The profit-share partners as users, in the order they were picked. */
const fetchProfitSharePartners = cache(
  async (): Promise<Array<Omit<ProfitSharePartner, 'amount'>>> => {
    const policy = await getProfitSharePolicy()
    if (!policy) return []
    const rows = await fetchUsersByIds(policy.partnerIds)
    const byId = new Map(rows.map(row => [row.id, row]))

    return policy.partnerIds.flatMap(id => {
      const row = byId.get(id)
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
  /**
   * The terms a closed month froze. Drift compares against these, so a later
   * change on Settings → Billing never reads as drift in an old month.
   */
  terms?: Pick<ProfitShareData, 'minimumBalance' | 'partners'>
}): Promise<ProfitShareData> {
  const [livePartners, policy] = params.terms
    ? [null, null]
    : await Promise.all([fetchProfitSharePartners(), getProfitSharePolicy()])
  // Frozen partners keep their amount field; computeProfitShare recomputes it.
  const partners = params.terms?.partners ?? livePartners ?? []
  return computeProfitShare({
    minimumBalance: params.terms?.minimumBalance ?? policy?.minimumBalance ?? 0,
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
