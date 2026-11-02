import type { StripeFeesState } from '@/lib/stripe/fees'

import { formatCurrency } from '@pts/ui/numbers'

type StripeFeesCardProps = {
  state: StripeFeesState
  /** Last day of the month, e.g. "Sep 30, 2026" — the entry's date. */
  entryDate: string
  /** Short month for the memo, e.g. "Sep 2026". */
  monthLabel: string
  /** The month is still running, so the figures are month-to-date. */
  inProgress?: boolean
}

function Line({
  label,
  debit,
  credit,
}: {
  label: string
  debit?: number
  credit?: number
}) {
  return (
    <div className='flex items-center gap-3 px-5 py-1.5 text-sm'>
      <span className='min-w-0 flex-1'>{label}</span>
      <span className='w-24 text-right tabular-nums'>
        {debit === undefined ? '' : formatCurrency(debit)}
      </span>
      <span className='w-24 text-right tabular-nums'>
        {credit === undefined ? '' : formatCurrency(credit)}
      </span>
    </div>
  )
}

export function StripeFeesCard({
  state,
  entryDate,
  monthLabel,
  inProgress,
}: StripeFeesCardProps) {
  const data = state.status === 'ready' ? state.data : null
  // Payouts land in the bank net of fees and are booked that way, so the
  // entry grosses revenue back up and moves the fees to cost of revenue.
  const memo = `Stripe fees ${monthLabel}; payouts were booked net`

  return (
    <section
      aria-labelledby='stripe-fees-title'
      className='bg-card overflow-hidden rounded-xl border shadow-sm'
    >
      <div className='flex items-center justify-between gap-4 border-b px-5 py-3.5'>
        <h2 id='stripe-fees-title' className='text-base font-semibold'>
          Stripe fees
          {inProgress ? (
            <span className='text-muted-foreground font-normal'>
              {' '}
              · so far
            </span>
          ) : null}
        </h2>
        <span className='text-base font-semibold tabular-nums'>
          {data ? formatCurrency(data.totalFees) : '—'}
        </span>
      </div>

      {state.status === 'not_configured' ? (
        <p className='text-muted-foreground px-5 py-8 text-center text-sm'>
          Stripe isn’t set up, so there are no fees to read.
        </p>
      ) : state.status === 'error' ? (
        <p className='text-destructive px-5 py-8 text-center text-sm'>
          Unable to read Stripe fees. {state.message}
        </p>
      ) : data && data.totalFees === 0 && data.paymentCount === 0 ? (
        <p className='text-muted-foreground px-5 py-8 text-center text-sm'>
          No Stripe activity this month.
        </p>
      ) : data ? (
        <div className='flex flex-col pb-3'>
          <div className='text-muted-foreground flex items-baseline gap-3 px-5 pt-3 pb-1.5 text-xs'>
            <span className='flex-1 font-semibold'>Journal entry</span>
            <span className='w-24 text-right'>Debit</span>
            <span className='w-24 text-right'>Credit</span>
          </div>
          <Line
            label='Cost of Revenue: Payment Processing Fees'
            debit={data.totalFees}
          />
          <Line label='Services Revenue' credit={data.totalFees} />
          <dl className='mx-5 mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]'>
            <dt className='text-muted-foreground'>Date</dt>
            <dd>{entryDate}</dd>
            <dt className='text-muted-foreground'>Memo</dt>
            <dd className='select-all'>{memo}</dd>
          </dl>

          <div className='mx-5 mt-3 space-y-1 border-t pt-3 text-[13px]'>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>
                Payments collected · {data.paymentCount}
              </span>
              <span className='tabular-nums'>
                {formatCurrency(data.grossPayments)}
              </span>
            </div>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>
                Processing fees
                {data.grossPayments > 0
                  ? ` · ${((data.processingFees / data.grossPayments) * 100).toFixed(1)}% of payments`
                  : ''}
              </span>
              <span className='tabular-nums'>
                {formatCurrency(data.processingFees)}
              </span>
            </div>
            {data.otherFees !== 0 ? (
              <div className='flex justify-between gap-3'>
                <span className='text-muted-foreground'>
                  Other Stripe fees
                </span>
                <span className='tabular-nums'>
                  {formatCurrency(data.otherFees)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
