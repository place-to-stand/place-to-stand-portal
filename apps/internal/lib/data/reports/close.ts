import 'server-only'

import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import {
  monthlyCloseClosedEvent,
  monthlyCloseReclosedEvent,
  monthlyCloseReopenedEvent,
} from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import {
  profitShareAppliesTo,
  type ProfitShareData,
} from '@/lib/billing/profit-share'
import { db } from '@/lib/db'
import {
  fetchLateRecords,
  getActiveSnapshot,
  hasActiveSnapshotForDate,
  insertSnapshot,
  softDeleteSnapshot,
  updateSnapshotReport,
} from '@/lib/queries/reports/close-snapshots'

import { fetchMonthlyCloseReport } from './monthly-close'
import { computeDeltas, computeProfitShareDeltas } from './close-drift'
import {
  buildProfitShare,
  loadMonthEndBalance,
  type MonthEndBalanceResult,
} from './profit-share'
import type { MonthlyCloseReport, ProfitShareState } from './types'

const SNAPSHOT_SCHEMA_VERSION = 1

// The snapshot shape and the pure snapshot-vs-live comparison live in
// ./close-drift so they can be exercised without a database or a session.

import type { CloseDriftDelta, SnapshotReport } from './close-drift'

// ---------------------------------------------------------------------------
// Snapshot payload validation (F9). The snapshot must decode without running
// live queries, and a shape mismatch must surface as an explicit error state
// — never a crash or a silent misread.
// ---------------------------------------------------------------------------

const payrollRowSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  updatedAt: z.string(),
  totalHours: z.number(),
  amount: z.number(),
})

const billingClientDetailSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  billingType: z.enum(['prepaid', 'net_30']),
  hours: z.number(),
  commission: z.number(),
})

const originationGroupRowSchema = z.object({
  originatorKind: z.enum(['user', 'contact']),
  originatorId: z.string(),
  originatorName: z.string(),
  originatorEmail: z.string(),
  originatorAvatarUrl: z.string().nullable(),
  originatorUpdatedAt: z.string().nullable(),
  clients: z.array(billingClientDetailSchema),
  totalHours: z.number(),
  totalCommission: z.number(),
})

// Closer details carry the closer's share. Snapshots taken before closer
// splits had one closer per client, so a missing share is exactly 100.
const closerClientDetailSchema = billingClientDetailSchema.extend({
  sharePercent: z.number().default(100),
})

const closerGroupRowFields = {
  closerName: z.string(),
  closerEmail: z.string(),
  closerAvatarUrl: z.string().nullable(),
  closerUpdatedAt: z.string().nullable(),
  clients: z.array(closerClientDetailSchema),
  totalHours: z.number(),
  totalCommission: z.number(),
}

// Pre-split snapshots keyed a closer by `closerUserId` (always an admin user)
// and allowed a null name; normalize them to the `closerKind` / `closerId`
// shape so drift compares like with like.
const closerGroupRowSchema = z.union([
  z.object({
    closerKind: z.enum(['user', 'contact']),
    closerId: z.string(),
    ...closerGroupRowFields,
  }),
  z
    .object({
      ...closerGroupRowFields,
      closerUserId: z.string(),
      closerName: z.string().nullable(),
    })
    .transform(({ closerUserId, ...row }) => ({
      ...row,
      closerKind: 'user' as const,
      closerId: closerUserId,
      closerName: row.closerName ?? row.closerEmail,
    })),
])

const partnerPayoutRowSchema = z.object({
  key: z.string(),
  kind: z.enum(['user', 'contact']),
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  avatarUpdatedAt: z.string().nullable(),
  payrollAmount: z.number(),
  originationAmount: z.number(),
  closerAmount: z.number(),
  totalAmount: z.number(),
})

const billingRowSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  totalHours: z.number(),
  amount: z.number(),
})

const ratesSchema = z.object({
  effectiveFrom: z.string(),
  billablePerHour: z.number(),
  payrollPerHour: z.number(),
  closerPerHour: z.number(),
  originationPerHour: z.number(),
  internalOriginationPayable: z.boolean(),
  housePerHour: z.number(),
})

const snapshotReportSchema = z.object({
  payroll: z.object({
    rows: z.array(payrollRowSchema),
    totalHours: z.number(),
    totalAmount: z.number(),
    hourlyRate: z.number(),
  }),
  origination: z.object({
    rows: z.array(originationGroupRowSchema),
    totalHours: z.number(),
    totalAmount: z.number(),
    commissionPerHour: z.number(),
  }),
  closer: z.object({
    rows: z.array(closerGroupRowSchema),
    totalHours: z.number(),
    totalAmount: z.number(),
    commissionPerHour: z.number(),
  }),
  partnerPayouts: z.object({
    rows: z.array(partnerPayoutRowSchema),
    totalPayroll: z.number(),
    totalOrigination: z.number(),
    totalCloser: z.number(),
    totalAmount: z.number(),
  }),
  prepaidBilling: z.object({
    rows: z.array(billingRowSchema),
    totalHours: z.number(),
    totalAmount: z.number(),
    hourlyRate: z.number(),
  }),
  net30Billing: z.object({
    rows: z.array(billingRowSchema),
    totalHours: z.number(),
    totalAmount: z.number(),
    hourlyRate: z.number(),
  }),
  house: z
    .object({
      billableHours: z.number(),
      ratePerHour: z.number(),
      totalAmount: z.number(),
      // PRD 007 fields. Snapshots frozen before them carry none; every such
      // month had a closer on every billed client, so the split is exact.
      nominalAmount: z.number().optional(),
      unassignedCloserHours: z.number().default(0),
      unassignedCloserAmount: z.number().default(0),
      // Origination became optional in Oct 2026. Earlier snapshots froze a
      // house total that never included an unassigned origination share, so
      // zero is what they actually recorded.
      unassignedOriginationHours: z.number().default(0),
      unassignedOriginationAmount: z.number().default(0),
    })
    .transform(house => ({
      ...house,
      nominalAmount:
        house.nominalAmount ??
        house.totalAmount -
          house.unassignedCloserAmount -
          house.unassignedOriginationAmount,
    })),
  workBillableHours: z.number(),
  workBillableTotal: z.number(),
  combinedBillingTotal: z.number(),
  combinedPayoutTotal: z.number(),
  rates: ratesSchema,
})

// Saved beside the report, not inside it: the report is DB-derived and the
// profit share adds the Mercury balance. Optional so closes frozen before the
// profit share existed still decode (they surface as "not saved").
const profitShareSchema = z.object({
  asOfDate: z.string(),
  monthComplete: z.boolean(),
  balance: z.number(),
  accounts: z.array(
    z.object({ id: z.string(), name: z.string(), balance: z.number() })
  ),
  fetchedAt: z.string(),
  addedAfterCloseAt: z.string().nullable(),
  payouts: z.number(),
  minimumBalance: z.number(),
  available: z.number(),
  shortfall: z.number(),
  partners: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      email: z.string(),
      avatarUpdatedAt: z.string().nullable(),
      amount: z.number(),
    })
  ),
  totalAmount: z.number(),
})

const snapshotEnvelopeSchema = z.object({
  schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
  report: snapshotReportSchema,
  profitShare: profitShareSchema.nullable().optional(),
})

type SnapshotParseResult =
  | { ok: true; report: SnapshotReport; profitShare: ProfitShareData | null }
  | { ok: false; error: string }

/**
 * Single decode point for persisted snapshots. Version 1 is identity; future
 * report-shape changes bump the version and migrate on read here. An unknown
 * version or failed parse returns an explicit error the UI renders as
 * "snapshot unreadable — reopen to re-derive".
 */
function parseSnapshotReport(payload: unknown): SnapshotParseResult {
  const parsed = snapshotEnvelopeSchema.safeParse(payload)

  if (!parsed.success) {
    const version =
      typeof payload === 'object' &&
      payload !== null &&
      'schemaVersion' in payload
        ? String((payload as { schemaVersion: unknown }).schemaVersion)
        : 'unknown'
    return {
      ok: false,
      error: `Snapshot is unreadable (schema version ${version}). Reopen the month to re-derive.`,
    }
  }

  return {
    ok: true,
    report: parsed.data.report,
    profitShare: parsed.data.profitShare ?? null,
  }
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function periodLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? `Month ${month}`} ${year}`
}

function monthDateRange(
  year: number,
  month: number
): { startDate: string; endDate: string } {
  const mm = String(month).padStart(2, '0')
  // Day 0 of the next month = last day of this month.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

function isFuturePeriod(year: number, month: number): boolean {
  const now = new Date()
  return (
    year > now.getUTCFullYear() ||
    (year === now.getUTCFullYear() && month > now.getUTCMonth() + 1)
  )
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  if ((error as { code?: string }).code === '23505') {
    return true
  }
  // drizzle-orm wraps driver errors (DrizzleQueryError) with the original
  // PostgresError on `cause`.
  const cause = (error as { cause?: unknown }).cause
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { code?: string }).code === '23505'
  )
}

function toSnapshotEnvelope(
  report: MonthlyCloseReport,
  profitShare: ProfitShareData | null
): {
  schemaVersion: number
  report: SnapshotReport
  profitShare: ProfitShareData | null
} {
  // Cursors are global navigation bounds, always computed live — excluded.
  const { minCursor, maxCursor, ...rest } = report
  void minCursor
  void maxCursor
  return { schemaVersion: SNAPSHOT_SCHEMA_VERSION, report: rest, profitShare }
}

export type CloseActionOutcome = { error?: string }

type ProfitShareForClose =
  | { ok: true; profitShare: ProfitShareData | null }
  | { ok: false; error: string }

/**
 * The profit share a close freezes. Months before the policy carry none. For
 * the rest a close needs a final month-end Mercury balance, so an unreadable
 * balance or a still-running month blocks the close rather than freezing a
 * close with no profit share.
 */
async function resolveProfitShareForClose(params: {
  year: number
  month: number
  payouts: number
  addedAfterCloseAt?: string
}): Promise<ProfitShareForClose> {
  const { year, month } = params
  if (!profitShareAppliesTo(year, month)) {
    return { ok: true, profitShare: null }
  }

  const balance = await loadMonthEndBalance(year, month)
  if (!balance.ok) {
    return {
      ok: false,
      error: `Unable to read the Mercury balance. ${balance.message}`,
    }
  }
  if (!balance.monthComplete) {
    return {
      ok: false,
      error: `Close ${periodLabel(year, month)} after it ends, once the month-end Mercury balance is final.`,
    }
  }

  const profitShare = await buildProfitShare({
    year,
    month,
    balance,
    payouts: params.payouts,
    addedAfterCloseAt: params.addedAfterCloseAt,
  })
  return { ok: true, profitShare }
}

// ---------------------------------------------------------------------------
// Close / reopen / re-close
// ---------------------------------------------------------------------------

/**
 * Closes a month: captures the cutoff BEFORE deriving (any record committed
 * after `closedAt` is by definition detectable as late), derives the live
 * report, and freezes it. The partial unique index is the concurrency
 * backstop — a concurrent close surfaces as "already closed".
 */
export async function closeMonth(
  user: AppUser,
  params: { year: number; month: number }
): Promise<CloseActionOutcome> {
  assertAdmin(user)
  const { year, month } = params

  if (isFuturePeriod(year, month)) {
    return { error: 'Cannot close a month that has not started.' }
  }

  const closedAt = new Date().toISOString()
  const { startDate, endDate } = monthDateRange(year, month)
  const report = await fetchMonthlyCloseReport(startDate, endDate)
  const profitShare = await resolveProfitShareForClose({
    year,
    month,
    payouts: report.partnerPayouts.totalAmount,
  })
  if (!profitShare.ok) {
    return { error: profitShare.error }
  }

  let snapshotId: string | null = null
  try {
    snapshotId = await insertSnapshot(db, {
      year,
      month,
      report: toSnapshotEnvelope(report, profitShare.profitShare),
      closedAt,
      closedBy: user.id,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: 'This month is already closed.' }
    }
    console.error('Failed to close month', error)
    return { error: 'Unable to close this month. Please try again.' }
  }

  if (snapshotId) {
    const event = monthlyCloseClosedEvent({
      year,
      month,
      combinedBillingTotal: report.combinedBillingTotal,
      combinedPayoutTotal: report.combinedPayoutTotal,
    })
    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'MONTHLY_CLOSE',
      targetId: snapshotId,
      metadata: event.metadata,
    })
  }

  return {}
}

export async function reopenMonth(
  user: AppUser,
  params: { year: number; month: number }
): Promise<CloseActionOutcome> {
  assertAdmin(user)
  const { year, month } = params

  const deletedId = await softDeleteSnapshot(db, year, month)

  if (!deletedId) {
    return { error: 'This month is not closed.' }
  }

  const event = monthlyCloseReopenedEvent({ year, month })
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'MONTHLY_CLOSE',
    targetId: deletedId,
    metadata: event.metadata,
  })

  return {}
}

/**
 * Atomic swap (F3), NOT sequential reopen→close: the replacement report is
 * derived first, then the old snapshot is soft-deleted and the new one
 * inserted in one transaction. A derivation or insert failure leaves the
 * original snapshot untouched — the month never transiently loses its close.
 */
export async function recloseMonth(
  user: AppUser,
  params: { year: number; month: number }
): Promise<CloseActionOutcome> {
  assertAdmin(user)
  const { year, month } = params

  const existing = await getActiveSnapshot(year, month)
  if (!existing) {
    return { error: 'This month is not closed.' }
  }

  const closedAt = new Date().toISOString()
  const { startDate, endDate } = monthDateRange(year, month)
  const report = await fetchMonthlyCloseReport(startDate, endDate)
  const profitShare = await resolveProfitShareForClose({
    year,
    month,
    payouts: report.partnerPayouts.totalAmount,
  })
  if (!profitShare.ok) {
    return { error: profitShare.error }
  }

  let snapshotId: string | null = null
  try {
    snapshotId = await db.transaction(async tx => {
      await softDeleteSnapshot(tx, year, month)
      return insertSnapshot(tx, {
        year,
        month,
        report: toSnapshotEnvelope(report, profitShare.profitShare),
        closedAt,
        closedBy: user.id,
      })
    })
  } catch (error) {
    console.error('Failed to re-close month', error)
    return { error: 'Unable to re-close this month. Please try again.' }
  }

  if (snapshotId) {
    const event = monthlyCloseReclosedEvent({
      year,
      month,
      combinedBillingTotal: report.combinedBillingTotal,
      combinedPayoutTotal: report.combinedPayoutTotal,
      previousSnapshotId: existing.id,
    })
    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'MONTHLY_CLOSE',
      targetId: snapshotId,
      metadata: event.metadata,
    })
  }

  return {}
}

/**
 * Adds the profit share to a month that was closed before the profit share
 * existed (August 2026, whose distribution went out by hand). It uses the
 * payouts frozen in that close, not live ones, and edits the snapshot in
 * place: nothing else in the close changes, so it is not a re-close.
 */
export async function addProfitShareToClose(
  user: AppUser,
  params: { year: number; month: number }
): Promise<CloseActionOutcome> {
  assertAdmin(user)
  const { year, month } = params

  const existing = await getActiveSnapshot(year, month)
  if (!existing) {
    return { error: 'This month is not closed.' }
  }

  const parsed = parseSnapshotReport(existing.report)
  if (!parsed.ok) {
    return { error: parsed.error }
  }
  if (parsed.profitShare) {
    return { error: 'This close already has a profit share.' }
  }
  if (!profitShareAppliesTo(year, month)) {
    return { error: 'Profit share does not apply to this month.' }
  }

  const profitShare = await resolveProfitShareForClose({
    year,
    month,
    payouts: parsed.report.partnerPayouts.totalAmount,
    addedAfterCloseAt: new Date().toISOString(),
  })
  if (!profitShare.ok) {
    return { error: profitShare.error }
  }

  const updated = await updateSnapshotReport(existing.id, {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    report: parsed.report,
    profitShare: profitShare.profitShare,
  })
  if (!updated) {
    return { error: 'Unable to save the profit share. Please try again.' }
  }

  return {}
}

/**
 * True when the month containing `date` ('yyyy-MM-dd') has an active close.
 * Gates billing-basis rewrites (hard block) and powers write-time warnings.
 */
export async function isMonthClosed(date: string): Promise<boolean> {
  return hasActiveSnapshotForDate(date)
}

/**
 * Non-blocking closed-month warning for time-log/hour-block writes (D9).
 * Checks every provided date and warns on the first closed month found.
 */
export async function closedMonthWarning(
  user: AppUser,
  dates: Array<string | null | undefined>
): Promise<string | undefined> {
  assertAdmin(user)

  const months = new Set<string>()
  for (const date of dates) {
    if (date) {
      months.add(date.slice(0, 7))
    }
  }

  for (const month of months) {
    const monthStart = `${month}-01`
    if (await isMonthClosed(monthStart)) {
      const [year, mm] = month.split('-').map(Number)
      return `${periodLabel(year, mm)} is closed — this change will show as drift on the monthly close report until it is reopened and re-closed.`
    }
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Snapshot-aware report view + drift detection (F2/F8)
// ---------------------------------------------------------------------------

type CloseDriftLateRecord = {
  kind: 'time_log' | 'hour_block'
  id: string
  clientName: string | null
  hours: number
  eventDate: string
  recordedAt: string
  change: 'added' | 'modified' | 'deleted'
}

export type CloseDrift = {
  hasDrift: boolean
  deltas: CloseDriftDelta[]
  lateRecords: CloseDriftLateRecord[]
}

export type MonthlyCloseView = {
  report: MonthlyCloseReport
  close: {
    status: 'open' | 'closed'
    closedAt?: string
    closedByName?: string | null
    /** Set when the persisted snapshot failed validation (F9). */
    snapshotError?: string
    drift?: CloseDrift | null
  }
  profitShare: ProfitShareState
}

/** The profit share recomputed from live payouts and the live balance. */
async function liveProfitShare(
  year: number,
  month: number,
  payouts: number,
  balance: MonthEndBalanceResult
): Promise<ProfitShareState> {
  if (!profitShareAppliesTo(year, month)) {
    return { status: 'inactive' }
  }
  if (!balance.ok) {
    return {
      status: 'unavailable',
      reason: balance.reason,
      message: balance.message,
    }
  }
  const data = await buildProfitShare({ year, month, balance, payouts })
  return { status: 'ready', data, source: 'live' }
}

/**
 * Live profit share for drift. When Mercury can't be read, the frozen balance
 * stands in, so payout changes still show their effect on each share.
 */
async function liveProfitShareForDrift(
  year: number,
  month: number,
  frozen: ProfitShareData,
  payouts: number,
  balance: MonthEndBalanceResult
): Promise<ProfitShareData> {
  const usable: Extract<MonthEndBalanceResult, { ok: true }> =
    balance.ok && balance.monthComplete
      ? balance
      : {
          ok: true,
          monthComplete: true,
          value: {
            cutoff: frozen.asOfDate,
            accounts: frozen.accounts,
            balance: frozen.balance,
            fetchedAt: frozen.fetchedAt,
          },
        }
  return buildProfitShare({ year, month, balance: usable, payouts })
}

async function computeDrift(
  snapshot: SnapshotReport,
  live: MonthlyCloseReport,
  params: {
    year: number
    month: number
    closedAt: string
    frozenProfitShare: ProfitShareData | null
    balance: Promise<MonthEndBalanceResult> | null
  }
): Promise<CloseDrift> {
  const deltas = computeDeltas(snapshot, live)
  if (params.frozenProfitShare && params.balance) {
    const liveShare = await liveProfitShareForDrift(
      params.year,
      params.month,
      params.frozenProfitShare,
      live.partnerPayouts.totalAmount,
      await params.balance
    )
    // First, so a capped display never hides what changes the checks.
    deltas.unshift(
      ...computeProfitShareDeltas(params.frozenProfitShare, liveShare)
    )
  }
  const { startDate, endDate } = monthDateRange(params.year, params.month)
  const lateRows = await fetchLateRecords(startDate, endDate, params.closedAt)

  const lateRecords: CloseDriftLateRecord[] = lateRows.map(row => {
    const change: CloseDriftLateRecord['change'] =
      row.deletedAt && row.deletedAt > params.closedAt
        ? 'deleted'
        : row.createdAt > params.closedAt
          ? 'added'
          : 'modified'

    return {
      kind: row.kind,
      id: row.id,
      clientName: row.clientName,
      hours: Number(row.hours),
      eventDate: row.eventDate,
      recordedAt:
        change === 'deleted'
          ? (row.deletedAt ?? row.updatedAt)
          : change === 'added'
            ? row.createdAt
            : row.updatedAt,
      change,
    }
  })

  // hasDrift is driven by the canonical comparison; lateRecords is
  // best-effort attribution (a billing-term or partner change produces a
  // delta with no matching record).
  return { hasDrift: deltas.length > 0, deltas, lateRecords }
}

/**
 * Snapshot-aware report fetch: open months render live; closed months render
 * the frozen snapshot (with live navigation cursors) plus a live-vs-snapshot
 * drift computation.
 */
export async function fetchMonthlyCloseView(
  year: number,
  month: number
): Promise<MonthlyCloseView> {
  const { startDate, endDate } = monthDateRange(year, month)
  const applies = profitShareAppliesTo(year, month)
  // Started up front so the Mercury round trip overlaps the database reads.
  const balance = applies ? loadMonthEndBalance(year, month) : null

  // Always derived: cursors for month navigation, and the live half of the
  // drift comparison. React cache() dedupes within the request.
  const [live, snapshot] = await Promise.all([
    fetchMonthlyCloseReport(startDate, endDate),
    getActiveSnapshot(year, month),
  ])

  const liveShare = async () =>
    balance
      ? liveProfitShare(
          year,
          month,
          live.partnerPayouts.totalAmount,
          await balance
        )
      : ({ status: 'inactive' } as const)

  if (!snapshot) {
    return {
      report: live,
      close: { status: 'open' },
      profitShare: await liveShare(),
    }
  }

  const parsed = parseSnapshotReport(snapshot.report)

  if (!parsed.ok) {
    return {
      report: live,
      close: {
        status: 'closed',
        closedAt: snapshot.closedAt,
        closedByName: snapshot.closedByName,
        snapshotError: parsed.error,
        drift: null,
      },
      profitShare: await liveShare(),
    }
  }

  const drift = await computeDrift(parsed.report, live, {
    year,
    month,
    closedAt: snapshot.closedAt,
    frozenProfitShare: parsed.profitShare,
    balance,
  })

  const profitShare: ProfitShareState = parsed.profitShare
    ? { status: 'ready', data: parsed.profitShare, source: 'snapshot' }
    : applies
      ? { status: 'not_saved' }
      : { status: 'inactive' }

  return {
    report: {
      ...parsed.report,
      minCursor: live.minCursor,
      maxCursor: live.maxCursor,
    },
    close: {
      status: 'closed',
      closedAt: snapshot.closedAt,
      closedByName: snapshot.closedByName,
      drift,
    },
    profitShare,
  }
}
