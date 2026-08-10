import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Shared layout helpers for the hidden /design style guide (PRD 004 §05).
 * A section = anchor target + h2; a specimen = labeled card of examples.
 */

export function DesignSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className='scroll-mt-16 space-y-4'>
      <div className='space-y-1'>
        <h2 className='text-xl font-semibold tracking-tight'>{title}</h2>
        {description ? (
          <p className='text-muted-foreground text-sm'>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function Specimen({
  label,
  note,
  children,
  className,
}: {
  label: string
  note?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className='space-y-2'>
      <div className='flex items-baseline gap-2'>
        <h3 className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
          {label}
        </h3>
        {note ? (
          <span className='text-muted-foreground text-xs'>{note}</span>
        ) : null}
      </div>
      <div
        className={cn(
          'bg-background flex flex-wrap items-center gap-3 rounded-lg border p-4',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
