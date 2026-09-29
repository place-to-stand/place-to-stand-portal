import { Info } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import type { MonthlyCloseReport } from '@/lib/data/reports/types'

import { formatHours, formatMoney, formatPercent } from './format'

type RateSplitCardProps = {
  report: MonthlyCloseReport
}

function Row({
  label,
  note,
  percent,
  basis,
  amount,
  muted,
}: {
  label: string
  note?: string
  percent: string
  basis: string
  amount: number
  muted?: boolean
}) {
  return (
    <div className='flex items-center gap-3 px-5 py-1.5 text-sm'>
      <div className='flex min-w-0 flex-1 items-center gap-1.5'>
        <span>{label}</span>
        {note ? (
          <Tooltip>
            <TooltipTrigger
              aria-label={note}
              className='text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -m-0.5 cursor-help rounded-sm p-0.5 outline-none focus-visible:ring-[3px]'
            >
              <Info className='size-3.5' />
            </TooltipTrigger>
            <TooltipContent className='max-w-64'>{note}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <span className='text-muted-foreground w-10 shrink-0 text-right text-[13px] tabular-nums'>
        {percent}
      </span>
      <span className='text-muted-foreground w-30 shrink-0 text-right text-[13px] tabular-nums'>
        {basis}
      </span>
      <span
        className={
          muted
            ? 'text-muted-foreground w-24 shrink-0 text-right tabular-nums'
            : 'w-24 shrink-0 text-right tabular-nums'
        }
      >
        {formatMoney(amount)}
      </span>
    </div>
  )
}

/**
 * How the billable rate splits this month. Payroll accrues on hours worked,
 * the rest on hours billed, so the four lines don't sum to billing in; the
 * footer names the two bases. Row notes sit behind an info icon.
 */
export function RateSplitCard({ report }: RateSplitCardProps) {
  const { rates, payroll, origination, closer, house } = report
  const pct = (rate: number) => formatPercent(rate, rates.billablePerHour)

  return (
    <section
      aria-labelledby='rate-split-title'
      className='bg-card overflow-hidden rounded-xl border shadow-sm'
    >
      <div className='flex items-center justify-between gap-4 border-b px-5 py-3.5'>
        <h2 id='rate-split-title' className='text-base font-semibold'>
          Rate split
        </h2>
        <span className='text-muted-foreground text-xs tabular-nums'>
          ${rates.billablePerHour}/hr
        </span>
      </div>
      <div className='flex flex-col py-2'>
        <Row
          label='Payroll'
          percent={pct(rates.payrollPerHour)}
          basis={`${formatHours(payroll.totalHours)} hrs worked`}
          amount={payroll.totalAmount}
        />
        <Row
          label='Origination'
          note={
            rates.internalOriginationPayable
              ? undefined
              : 'External referrers only this period'
          }
          percent={pct(rates.originationPerHour)}
          basis={`${formatHours(origination.totalHours)} hrs billed`}
          amount={origination.totalAmount}
        />
        {rates.closerPerHour > 0 ? (
          <Row
            label='Closer'
            percent={pct(rates.closerPerHour)}
            basis={`${formatHours(closer.totalHours)} hrs billed`}
            amount={closer.totalAmount}
          />
        ) : null}
        <Row
          label='House (est.)'
          note={
            house.unassignedCloserAmount > 0
              ? `Includes ${formatMoney(house.unassignedCloserAmount)} closer share from ${formatHours(house.unassignedCloserHours)} hrs with no closer`
              : undefined
          }
          percent={pct(rates.housePerHour)}
          basis={`${formatHours(house.billableHours)} hrs billed`}
          amount={house.totalAmount}
          muted
        />
      </div>
      <p className='bg-muted/50 text-muted-foreground border-t px-5 py-3 text-xs'>
        Payroll accrues on hours worked and the rest on hours billed.
      </p>
    </section>
  )
}
