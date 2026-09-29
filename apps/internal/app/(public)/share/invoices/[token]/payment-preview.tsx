import { cn } from '@/lib/utils'

import { formatCurrency } from './format'
import { DARK_LABEL, HEADLINE_FONT, PANEL_TITLE } from './styles'

/**
 * Stands in for `PaymentPanel` on the admin preview. The real panel opens a
 * Stripe checkout session the moment it mounts, which a preview must not do.
 */
export function PaymentPreview({ total }: { total: string }) {
  return (
    <>
      <div className='flex flex-col gap-2'>
        <h2 className={PANEL_TITLE}>Pay this invoice</h2>
        <p className='text-brand-text-muted text-sm leading-normal'>
          Pay securely below.
        </p>
      </div>

      <div className='border-brand-border flex items-baseline justify-between border-y py-3.5'>
        <span className={DARK_LABEL}>Amount due</span>
        <span
          className={cn(
            HEADLINE_FONT,
            'text-[22px] leading-none font-bold tracking-[-0.02em] tabular-nums'
          )}
        >
          {formatCurrency(total)}
        </span>
      </div>

      <div className='border-brand-border text-brand-text-muted flex items-center justify-center border border-dashed px-4 py-10 text-center text-sm'>
        The card form appears here once the invoice is sent.
      </div>
    </>
  )
}
