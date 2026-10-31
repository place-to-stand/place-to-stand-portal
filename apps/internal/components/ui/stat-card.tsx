import type { ReactNode } from 'react'

import {
  BALANCE_TONE_CLASS,
  type BalanceTone,
} from '@/lib/billing/balance-tone'
import { cn } from '@/lib/utils'

/**
 * One figure with its label above it ("Project this month", "12.5h"), in a
 * small tinted card. Set them side by side in a grid for a pair of stats.
 */
export function StatCard({
  label,
  value,
  tone = 'default',
  className,
}: {
  label: string
  value: ReactNode
  /**
   * A balance's colour (`balanceTone`): `positive` muted green (hours left),
   * `negative` muted red (overdrawn).
   */
  tone?: BalanceTone
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-muted/40 flex min-w-0 flex-col gap-0.5 rounded-lg border px-4 py-3',
        className
      )}
    >
      <span className='text-muted-foreground truncate text-xs'>{label}</span>
      <span
        className={cn(
          'text-lg leading-tight font-semibold tabular-nums',
          BALANCE_TONE_CLASS[tone]
        )}
      >
        {value}
      </span>
    </div>
  )
}
