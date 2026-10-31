import type { ReactNode } from 'react'

import {
  BALANCE_TONE_CLASS,
  type BalanceTone,
} from '@/lib/billing/balance-tone'
import { cn } from '@/lib/utils'

/**
 * Read-only context above a form (the time log dialog's client, project and
 * hours): one flat tinted panel with no border, so it never reads as an
 * input. Put `InfoPanelStats` inside for figures; follow it with a hairline
 * and a 24px gap before the form (`InfoPanelDivider`).
 */
export function InfoPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-muted/50 flex flex-col overflow-hidden rounded-lg text-sm',
        className
      )}
    >
      {children}
    </div>
  )
}

/** The panel's top part: names and badges, one per line. */
export function InfoPanelBody({ children }: { children: ReactNode }) {
  return <div className='flex flex-col gap-1.5 px-4 py-3'>{children}</div>
}

/** Figures in cells side by side, split from the body and each other by hairlines. */
export function InfoPanelStats({
  stats,
}: {
  stats: Array<{
    label: string
    value: ReactNode
    /** A balance's colour (`balanceTone`). */
    tone?: BalanceTone
  }>
}) {
  return (
    <dl
      className='border-border/60 divide-border/60 grid divide-x border-t'
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
    >
      {stats.map(stat => (
        <div
          key={stat.label}
          className='flex min-w-0 flex-col gap-0.5 px-4 py-3'
        >
          <dt className='text-muted-foreground truncate text-xs'>
            {stat.label}
          </dt>
          <dd
            className={cn(
              'text-lg leading-tight font-semibold tabular-nums',
              BALANCE_TONE_CLASS[stat.tone ?? 'default']
            )}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Between the panel and the form: a full-width hairline, 24px of air. */
export function InfoPanelDivider() {
  return <hr className='border-border/70 -mx-6 my-2' aria-hidden />
}
