import type { Net30Data, PrepaidBillingData } from '@/lib/data/reports/types'

import { formatHours, formatMoney } from './format'

type BillingInCardProps = {
  prepaid: PrepaidBillingData
  net30: Net30Data
  total: number
}

function Group({
  label,
  hours,
  amount,
  rows,
  first,
}: {
  label: string
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
      <div
        className={
          first
            ? 'flex items-center gap-3 px-5 pt-2.5 pb-1'
            : 'flex items-center gap-3 px-5 pt-4 pb-1'
        }
      >
        <span className='text-muted-foreground flex-1 text-[11px] font-semibold tracking-wide uppercase'>
          {label}
        </span>
        <span className='text-muted-foreground w-18 text-right text-xs tabular-nums'>
          {formatHours(hours)} hrs
        </span>
        <span className='text-muted-foreground w-24 text-right text-xs font-medium tabular-nums'>
          {formatMoney(amount)}
        </span>
      </div>
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
      <div className='flex items-center justify-between gap-4 border-b px-5 py-3.5'>
        <h2 id='billing-in-title' className='text-base font-semibold'>
          Billing in
        </h2>
        <span className='text-base font-semibold tabular-nums'>
          {formatMoney(total)}
        </span>
      </div>
      {empty ? (
        <p className='text-muted-foreground px-5 py-8 text-center text-sm'>
          No billing this month.
        </p>
      ) : (
        <div className='flex flex-col pb-2'>
          <Group
            first
            label='Prepaid · hour blocks sold'
            hours={prepaid.totalHours}
            amount={prepaid.totalAmount}
            rows={prepaid.rows}
          />
          <Group
            first={prepaid.rows.length === 0}
            label='Net 30 · hours logged'
            hours={net30.totalHours}
            amount={net30.totalAmount}
            rows={net30.rows}
          />
        </div>
      )}
    </section>
  )
}
