// Types for Monthly Close Report

import type { PartnerRateSchedule } from '@/lib/billing/partner-rates'
import type { ProfitShareData } from '@/lib/billing/profit-share'

/**
 * The profit share as the page shows it. `inactive`: the month predates the
 * policy. `not_saved`: the month was closed without one (closed before the
 * policy shipped). `unavailable`: Mercury couldn't be read for a live month.
 */
export type ProfitShareState =
  | { status: 'inactive' }
  | { status: 'ready'; data: ProfitShareData; source: 'live' | 'snapshot' }
  | { status: 'not_saved' }
  | {
      status: 'unavailable'
      reason: 'not_configured' | 'error'
      message: string
    }

export type MonthCursor = {
  year: number
  month: number // 1-indexed (1 = January, 12 = December)
}

type OriginatorKind = 'user' | 'contact'

// Payroll
export type PayrollRow = {
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  updatedAt: string
  totalHours: number
  amount: number
}

export type PayrollData = {
  rows: PayrollRow[]
  totalHours: number
  totalAmount: number
  hourlyRate: number
}

// Origination — the "finder" bucket. Each row is one client under one
// originator; the data layer groups them by `${kind}:${id}` to roll totals
// per originator across both billing types.
export type OriginationClientDetail = {
  clientId: string
  clientName: string
  billingType: 'prepaid' | 'net_30'
  hours: number
  commission: number
}

export type OriginationGroupRow = {
  originatorKind: OriginatorKind
  originatorId: string
  originatorName: string
  originatorEmail: string
  /** Only populated for `originatorKind === 'user'`. */
  originatorAvatarUrl: string | null
  originatorUpdatedAt: string | null
  clients: OriginationClientDetail[]
  totalHours: number
  totalCommission: number
}

export type OriginationData = {
  rows: OriginationGroupRow[]
  totalHours: number
  totalAmount: number
  commissionPerHour: number
}

// Closer — whoever finalized the deal: admin users and/or contacts sharing
// the closer rate by percentage. Each client detail is one closer's share of
// one client: `hours` are the CREDITED hours (client billing hours × share),
// so `commission = hours × rate` and the section totals stay rate × hours.
export type CloserClientDetail = {
  clientId: string
  clientName: string
  billingType: 'prepaid' | 'net_30'
  /** Credited hours: the client's billing hours × sharePercent / 100. */
  hours: number
  /** This closer's share of the client's closer rate (100 for a sole closer). */
  sharePercent: number
  commission: number
}

export type CloserGroupRow = {
  closerKind: OriginatorKind
  closerId: string
  closerName: string
  closerEmail: string
  /** Only populated for `closerKind === 'user'`. */
  closerAvatarUrl: string | null
  closerUpdatedAt: string | null
  clients: CloserClientDetail[]
  /** Sum of credited hours. */
  totalHours: number
  totalCommission: number
}

export type CloserData = {
  rows: CloserGroupRow[]
  /** Credited hours across all closers — never more than billing hours. */
  totalHours: number
  totalAmount: number
  commissionPerHour: number
}

// Prepaid billing
export type PrepaidBillingRow = {
  clientId: string
  clientName: string
  totalHours: number
  amount: number
}

export type PrepaidBillingData = {
  rows: PrepaidBillingRow[]
  totalHours: number
  totalAmount: number
  hourlyRate: number
}

// Net 30 billing
export type Net30Row = {
  clientId: string
  clientName: string
  totalHours: number
  amount: number
}

export type Net30Data = {
  rows: Net30Row[]
  totalHours: number
  totalAmount: number
  hourlyRate: number
}

// Partner Payouts — lump-sum view. Groups Payroll + Origination + Closer
// by payee so the bookkeeper has one row per check to cut.
type PartnerPayoutPayeeKind = 'user' | 'contact'

export type PartnerPayoutRow = {
  /** `${kind}:${id}` — unique across users and contacts. */
  key: string
  kind: PartnerPayoutPayeeKind
  id: string
  name: string
  email: string
  /** Only populated for `kind === 'user'`. */
  avatarUrl: string | null
  avatarUpdatedAt: string | null
  payrollAmount: number
  originationAmount: number
  closerAmount: number
  totalAmount: number
}

export type PartnerPayoutData = {
  rows: PartnerPayoutRow[]
  totalPayroll: number
  totalOrigination: number
  totalCloser: number
  totalAmount: number
}

// House — the firm's share of billing. ESTIMATED, not a payout:
//   nominalAmount        = billingHours × rates.housePerHour
//   unassignedCloserAmount = billing hours not credited to any closer (no
//                            closer on the as-of term, or an archived one)
//                            × rates.closerPerHour (PRD 007 — the closer
//                            share is not paid out, it stays in house)
//   totalAmount          = nominalAmount + unassignedCloserAmount
// `billingHours = prepaidBilling.totalHours + net30Billing.totalHours`, the
// same population as origination/closer. Payroll is on a work basis, so the
// four buckets do not reconcile to Billing In in a single month; house is
// the firm's nominal share, not cash left over.
export type HouseData = {
  /** Total billing hours in the period (prepaid purchased + net_30 logged). */
  billableHours: number
  /** Nominal house rate for this period (e.g. $50/hr or $80/hr). */
  ratePerHour: number
  /** billingHours × ratePerHour — the firm's nominal share of billing. */
  nominalAmount: number
  /** Billing hours not credited to a paid closer. */
  unassignedCloserHours: number
  /** unassignedCloserHours × rates.closerPerHour — kept in house, not paid. */
  unassignedCloserAmount: number
  /** nominalAmount + unassignedCloserAmount. Estimated. */
  totalAmount: number
}

export type MonthlyCloseReport = {
  payroll: PayrollData
  origination: OriginationData
  closer: CloserData
  partnerPayouts: PartnerPayoutData
  prepaidBilling: PrepaidBillingData
  net30Billing: Net30Data
  house: HouseData
  /** Admin hours logged on CLIENT projects in the period. */
  workBillableHours: number
  /** `workBillableHours × billablePerHour` — the accrual basis for payouts. */
  workBillableTotal: number
  /** Combined billing in (prepaid purchased + net_30 logged) — cash-flow view. */
  combinedBillingTotal: number
  /** Combined payouts (payroll + origination + closer). */
  combinedPayoutTotal: number
  /** The partner rate schedule that was in effect for this reporting period. */
  rates: PartnerRateSchedule
  minCursor: MonthCursor
  maxCursor: MonthCursor
}
