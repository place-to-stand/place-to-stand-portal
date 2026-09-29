import type { Net30Data, PrepaidBillingData } from '@/lib/data/reports/types'
import { cn } from '@/lib/utils'

import { formatHours, formatMoney } from './format'

type BillingInCardProps = {
  prepaid: PrepaidBillingData
  net30: Net30Data
  total: number
}

function Group({
  label,
  basis,
  hours,
  amount,
  rows,
  first,
}: {
  label: string
  basis: string
  hours: number
  amount: number
  rows: Array<{
    clientId: string
    clientName: string
    totalHours: number
    amount: number
  }>
  first?: boolean
}) {
  if (rows.length === 0) return null
  return (
    <>
      {/* A full-width band, like a table's group header, so each billing
          type reads as its own section rather than another row. */}
      <div
        className={cn(
          'bg-muted/50 flex items-baseline gap-3 border-y px-5 py-2 text-sm',
          !first && 'mt-1'
        )}
      >
        <span className='flex-1'>
          <span className='font-semibold'>{label}</span>
          <span className='text-muted-foreground'> · {basis}</span>
        </span>
        <span className='text-muted-foreground w-18 text-right text-[13px] tabular-nums'>
          {formatHours(hours)} hrs
        </span>
        <span className='w-24 text-right font-semibold tabular-nums'>
          {formatMoney(amount)}
        </span>
      </div>
      <div className='flex flex-col py-1'>
        {rows.map(row => (
          <div
            key={row.clientId}
            className='flex items-center gap-3 px-5 py-1.5 text-sm'
          >
            <span className='min-w-0 flex-1'>{row.clientName}</span>
            <span className='text-muted-foreground w-18 text-right text-[13px] tabular-nums'>
              {formatHours(row.totalHours)}
            </span>
            <span className='w-24 text-right tabular-nums'>
              {formatMoney(row.amount)}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

export function BillingInCard({ prepaid, net30, total }: BillingInCardProps) {
  const empty = prepaid.rows.length === 0 && net30.rows.length === 0

  return (
    <section
      aria-labelledby='billing-in-title'
      className='bg-card overflow-hidden rounded-xl border shadow-sm'
    >
      <div className='flex items-center justify-between gap-4 px-5 py-3.5'>
        <h2 id='billing-in-title' className='text-base font-semibold'>
          Billing in
        </h2>
        <span className='text-base font-semibold tabular-nums'>
          {formatMoney(total)}
        </span>
      </div>
      {empty ? (
        <p className='text-muted-foreground border-t px-5 py-8 text-center text-sm'>
          No billing this month.
        </p>
      ) : (
        <div className='flex flex-col pb-1'>
          <Group
            first
            label='Prepaid'
            basis='hour blocks sold'
            hours={prepaid.totalHours}
            amount={prepaid.totalAmount}
            rows={prepaid.rows}
          />
          <Group
            first={prepaid.rows.length === 0}
            label='Net 30'
            basis='hours logged'
            hours={net30.totalHours}
            amount={net30.totalAmount}
            rows={net30.rows}
          />
        </div>
      )}
    </section>
  )
}
