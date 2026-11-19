import type { ReactNode } from 'react'

import { PagePanel } from '@/components/layout/page-panel'

/** One System health panel: a titled box with a status on the right. */
export function HealthPanel({
  title,
  status,
  alert = false,
  children,
}: {
  title: string
  status?: string
  alert?: boolean
  children: ReactNode
}) {
  return (
    <PagePanel aria-label={title} flush className='overflow-hidden'>
      <div className='bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-2.5'>
        <h2 className='text-sm font-semibold'>{title}</h2>
        {status ? (
          <span
            className={
              alert
                ? 'text-destructive text-xs font-semibold'
                : 'text-muted-foreground text-xs'
            }
          >
            {status}
          </span>
        ) : null}
      </div>
      {children}
    </PagePanel>
  )
}

export function Stat({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string
  value: number | string
  hint: string
  alert?: boolean
}) {
  return (
    <div className='flex flex-col gap-1 px-4 py-3'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd
        className={
          alert
            ? 'text-destructive text-2xl font-semibold tabular-nums'
            : 'text-2xl font-semibold tabular-nums'
        }
      >
        {value}
      </dd>
      <dd className='text-muted-foreground text-xs'>{hint}</dd>
    </div>
  )
}

/** A short state word, red when it needs a look. */
export function StateLabel({
  children,
  alert = false,
}: {
  children: ReactNode
  alert?: boolean
}) {
  return (
    <span
      className={
        alert
          ? 'text-destructive text-sm font-semibold'
          : 'text-muted-foreground text-sm'
      }
    >
      {children}
    </span>
  )
}

export function PanelNote({ children }: { children: ReactNode }) {
  return (
    <p className='text-muted-foreground border-t px-4 py-2.5 text-xs'>
      {children}
    </p>
  )
}
