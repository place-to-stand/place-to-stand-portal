import { formatCalendarDate } from '@pts/ui/dates'

import { PROFIT_SHARE_POLICY } from '@/lib/billing/profit-share'
import type {
  MonthlyCloseReport,
  ProfitShareState,
} from '@/lib/data/reports/types'

import { formatHours, formatMoney, formatShortDay } from './format'

type SummaryStripProps = {
  report: MonthlyCloseReport
  profitShare: ProfitShareState
  /** The month is still running: every figure is "so far". */
  inProgress: boolean
}

function Stat({
  label,
  value,
  caption,
  muted,
}: {
  label: string
  value: string
  caption: string
  muted?: boolean
}) {
  return (
    <div className='flex min-w-0 flex-col gap-1.5 px-5 py-4'>
      <span className='text-muted-foreground text-xs font-medium'>{label}</span>
      <span
        className={
          muted
            ? 'text-muted-foreground text-2xl leading-8 font-semibold'
            : 'text-2xl leading-8 font-semibold tracking-tight tabular-nums'
        }
      >
        {value}
      </span>
      <span className='text-muted-foreground text-xs tabular-nums'>
        {caption}
      </span>
    </div>
  )
}

function profitShareStat(
  state: ProfitShareState,
  inProgress: boolean
): { value: string; caption: string; muted?: boolean } {
  switch (state.status) {
    case 'ready': {
      const { data } = state
      if (state.source === 'snapshot') {
        return {
          value: formatMoney(data.totalAmount),
          caption: `From the ${formatMoney(data.balance)} ${formatShortDay(data.asOfDate)} balance`,
        }
      }
      if (inProgress) {
        return {
          value: formatMoney(data.totalAmount),
          caption: `From today's ${formatMoney(data.balance)} balance`,
        }
      }
      return {
        value: formatMoney(data.totalAmount),
        caption:
          data.totalAmount > 0
            ? `${formatMoney(data.partners[0]?.amount ?? 0)} each to ${data.partners.length} partners`
            : 'Balance is under the minimum',
      }
    }
    case 'not_saved':
      return { value: '—', caption: 'Not saved with this close', muted: true }
    case 'unavailable':
      return { value: '—', caption: 'Mercury balance unavailable', muted: true }
    case 'inactive':
      return {
        value: '—',
        caption: `Starts with ${formatCalendarDate(PROFIT_SHARE_POLICY.effectiveFrom, { month: 'long', year: 'numeric' })}`,
        muted: true,
      }
  }
}

export function SummaryStrip({
  report,
  profitShare,
  inProgress,
}: SummaryStripProps) {
  const soFar = inProgress ? ' so far' : ''
  const billedHours =
    report.prepaidBilling.totalHours + report.net30Billing.totalHours
  const share = profitShareStat(profitShare, inProgress)

  const payoutParts = [
    report.rates.payrollPerHour > 0 ? 'Payroll' : null,
    report.rates.originationPerHour > 0 ? 'origination' : null,
    report.rates.closerPerHour > 0 ? 'closer' : null,
  ].filter(Boolean) as string[]
  const payoutCaption =
    payoutParts.length > 1
      ? `${payoutParts.slice(0, -1).join(', ')} and ${payoutParts.at(-1)}`
      : (payoutParts[0] ?? '')

  // gap-px over a border-colored ground draws the dividers in every layout
  // (1, 2 or 4 columns) without per-breakpoint border rules.
  return (
    <section
      aria-label='Summary'
      className='bg-border [&>*]:bg-card grid gap-px overflow-hidden rounded-xl border shadow-sm sm:grid-cols-2 lg:grid-cols-4'
    >
      <Stat
        label={`Billing in${soFar}`}
        value={formatMoney(report.combinedBillingTotal)}
        caption={`Prepaid ${formatMoney(report.prepaidBilling.totalAmount)} · Net 30 ${formatMoney(report.net30Billing.totalAmount)}`}
      />
      <Stat
        label={`Hours worked${soFar}`}
        value={formatHours(report.workBillableHours)}
        caption={`${formatHours(billedHours)} hrs billed`}
      />
      <Stat
        label={`Partner payouts${soFar}`}
        value={formatMoney(report.partnerPayouts.totalAmount)}
        caption={payoutCaption}
      />
      <Stat
        label={inProgress ? 'Profit share so far' : 'Profit share'}
        value={share.value}
        caption={share.caption}
        muted={share.muted}
      />
    </section>
  )
}
