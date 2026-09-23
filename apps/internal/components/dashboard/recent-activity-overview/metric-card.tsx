'use client'

import { cn } from '@/lib/utils'

type MetricCardProps = {
  value: number
  label: string
  variant?: 'default' | 'warning'
}

export function MetricCard({
  value,
  label,
  variant = 'default',
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border px-2 py-2',
        variant === 'warning' && value > 0
          ? 'border-warning/50 bg-warning/10 text-warning'
          : 'bg-muted/50'
      )}
    >
      <span
        className={cn(
          'text-xl leading-tight font-bold tabular-nums',
          variant === 'warning' && value > 0
            ? 'text-warning'
            : 'text-foreground'
        )}
      >
        {value}
      </span>
      <span className='text-muted-foreground text-[10px] leading-tight'>
        {label}
      </span>
    </div>
  )
}

export function MetricCardSkeleton() {
  return (
    <div className='bg-muted/50 flex flex-col items-center justify-center rounded-lg border px-2 py-2'>
      <div className='bg-muted h-6 w-8 animate-pulse rounded' />
      <div className='bg-muted mt-1 h-2.5 w-12 animate-pulse rounded' />
    </div>
  )
}
