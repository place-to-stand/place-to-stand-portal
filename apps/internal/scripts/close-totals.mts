/**
 * Every month's monthly close, recomputed live, beside its closed snapshot.
 *
 *   DATABASE_URL=<local url> npx tsx --require ./scripts/stub-server-only.cjs \
 *     scripts/close-totals.mts > before.json
 *
 * Run before and after a change to the close and diff the two files: a closed
 * month's live totals should match its snapshot, and no month should move
 * unless the change meant it to. Local databases only.
 */
import { createHash } from 'node:crypto'

import postgres from 'postgres'

import { fetchMonthlyCloseReport } from '@/lib/data/reports/monthly-close'

const url = process.env.DATABASE_URL ?? ''
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error('close-totals runs against a local database only.')
  process.exit(1)
}

type Totals = Record<string, number | string>
// A report or a snapshot's report: read loosely, it only feeds a comparison.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseReport = any

// Section totals plus a per-client line, so a moved client shows by name.
function totalsOf(report: LooseReport): Totals {
  const round = (n: number) => Math.round(n * 100) / 100
  const out: Totals = {
    billingIn: round(report.combinedBillingTotal),
    payouts: round(report.combinedPayoutTotal),
    payroll: round(report.payroll?.totalAmount ?? 0),
    origination: round(report.origination?.totalCommission ?? 0),
    closer: round(report.closer?.totalCommission ?? 0),
    prepaid: round(report.prepaidBilling?.totalAmount ?? 0),
    net30: round(report.net30Billing?.totalAmount ?? 0),
    workBillableHours: round(report.workBillableHours ?? 0),
  }
  for (const section of ['prepaidBilling', 'net30Billing'] as const) {
    for (const row of report[section]?.rows ?? []) {
      out[`${section}:${row.clientId}`] = round(row.totalAmount ?? row.amount ?? 0)
    }
  }
  return out
}

void (async () => {
  const sql = postgres(url, { max: 1 })
  const snapshots = await sql<{ year: number; month: number; report: LooseReport }[]>`
    select year, month, report from monthly_close_snapshots
    where deleted_at is null order by year, month`
  const bounds = await fetchMonthlyCloseReport('2026-09-01', '2026-09-30')
  const months: string[] = []
  let { year, month } = bounds.minCursor
  const end = bounds.maxCursor
  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  const result: Record<string, { live: Totals; snapshot?: Totals }> = {}
  for (const key of months) {
    const [y, m] = key.split('-').map(Number)
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const report = await fetchMonthlyCloseReport(`${key}-01`, `${key}-${last}`)
    const snap = snapshots.find(s => s.year === y && s.month === m)
    const digest = createHash('sha256').update(JSON.stringify({ ...report, minCursor: null, maxCursor: null })).digest('hex').slice(0, 16)
    result[key] = { live: { ...totalsOf(report), digest }, ...(snap ? { snapshot: totalsOf(snap.report.report ?? snap.report) } : {}) }
  }
  console.log(JSON.stringify(result, null, 2))
  await sql.end()
  process.exit(0)
})()
