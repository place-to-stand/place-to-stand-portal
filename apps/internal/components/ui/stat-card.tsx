import type { ReactNode } from 'react'

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
  /** `negative`: the value is below zero (an overdrawn balance). */
  tone?: 'default' | 'negative'
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
          tone === 'negative' && 'text-destructive'
        )}
      >
        {value}
      </span>
    </div>
  )
}
