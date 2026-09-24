import { Check } from 'lucide-react'

import { formatCurrency, formatDate } from './format'
import { DARK_LABEL, PANEL_TITLE } from './styles'

/**
 * Stands in for the payment form once an invoice is paid. No payment method
 * row: Link's bank and Klarna payments settle as `card`, so "Card" would
 * mislabel them.
 */
export function ReceiptPanel({
  total,
  paidAt,
}: {
  total: string
  paidAt: string | null
}) {
  const paidOn = formatDate(paidAt)

  return (
    <>
      <div className='flex items-center gap-3'>
        <span className='border-brand-lime/50 text-brand-lime inline-flex size-8 shrink-0 items-center justify-center border'>
          <Check className='size-4' strokeWidth={2} />
        </span>
        <h2 className={PANEL_TITLE}>Payment received</h2>
      </div>
      <p className='text-brand-text-muted text-sm leading-normal'>
        Thank you. This invoice is paid in full and nothing further is due.
      </p>
      <dl className='flex flex-col'>
        <ReceiptRow label='Amount paid' value={formatCurrency(total)} numeric />
        {paidOn ? <ReceiptRow label='Paid on' value={paidOn} /> : null}
      </dl>
    </>
  )
}

function ReceiptRow({
  label,
  value,
  numeric = false,
}: {
  label: string
  value: string
  numeric?: boolean
}) {
  return (
    <div className='border-brand-border flex items-baseline justify-between border-t py-3 last:border-b'>
      <dt className={DARK_LABEL}>{label}</dt>
      <dd
        className={
          numeric ? 'text-sm font-medium tabular-nums' : 'text-sm font-medium'
        }
      >
        {value}
      </dd>
    </div>
  )
}
