import type { SalesTaxData } from '@/lib/data/reports/types'

import { formatMoney, formatShortDay } from './format'
import { TreeBranch } from './tree-branch'

type SalesTaxCardProps = {
  salesTax: SalesTaxData
  /** A closed month that predates frozen sales tax shows the live figure. */
  isLive?: boolean
}

/** 0.0725 → "7.25%"; trailing zeros dropped so 0.08 reads "8%". */
function formatRate(rate: number): string {
  return `${Number((rate * 100).toFixed(3))}%`
}

export function SalesTaxCard({ salesTax, isLive }: SalesTaxCardProps) {
  const { rows } = salesTax

  return (
    <section
      aria-labelledby='sales-tax-title'
      className='bg-card overflow-hidden rounded-xl border shadow-sm'
    >
      <div className='flex items-center justify-between gap-4 border-b px-5 py-3.5'>
        <h2 id='sales-tax-title' className='text-base font-semibold'>
          Sales tax owed
        </h2>
        <span className='text-base font-semibold tabular-nums'>
          {formatMoney(salesTax.totalAmount)}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className='text-muted-foreground px-5 py-8 text-center text-sm'>
          No sales tax collected this month.
        </p>
      ) : (
        <div className='flex flex-col pb-3'>
          <div className='flex items-baseline gap-3 px-5 pt-3 pb-1.5 text-sm'>
            <span className='flex-1'>
              <span className='font-semibold'>Collected</span>
              <span className='text-muted-foreground'> · invoices paid</span>
            </span>
            <span className='text-muted-foreground text-right text-[13px] tabular-nums'>
              on {formatMoney(salesTax.totalTaxable)}
            </span>
          </div>
          {rows.map((row, index) => (
            <div
              key={row.invoiceId}
              className='flex items-center gap-3 px-5 py-1.5 text-sm'
            >
              <span className='flex min-w-0 flex-1 items-center gap-2'>
                <TreeBranch first={index === 0} last={index === rows.length - 1} />
                <span className='min-w-0'>
                  {row.clientName}
                  <span className='text-muted-foreground'>
                    {' '}
                    · {row.invoiceNumber ?? 'Invoice'} ·{' '}
                    {formatShortDay(row.paidOn)}
                  </span>
                </span>
              </span>
              <span className='text-muted-foreground w-18 text-right text-[13px] tabular-nums'>
                {formatRate(row.taxRate)}
              </span>
              <span className='w-24 text-right tabular-nums'>
                {formatMoney(row.taxAmount)}
              </span>
            </div>
          ))}
        </div>
      )}
      {isLive ? (
        <p className='text-muted-foreground border-t px-5 py-2.5 text-xs'>
          This month closed before sales tax was saved with the close, so this
          is the current figure.
        </p>
      ) : null}
    </section>
  )
}
