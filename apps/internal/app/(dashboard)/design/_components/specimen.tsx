import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { DesignSectionId } from './sections'

/**
 * Framing for the /design style guide. Everything inside a specimen is a real
 * component; these helpers only lay the page out.
 */

/** A section: anchor, heading, one line on when to use it, then examples. */
export function DesignSection({
  id,
  title,
  when,
  children,
}: {
  id: DesignSectionId
  title: string
  /** One line: when to reach for this. */
  when: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      data-design-section
      className='scroll-mt-6 border-t pt-10 first:border-t-0 first:pt-0'
    >
      <header className='mb-6 max-w-2xl space-y-1.5'>
        <h2 className='text-xl font-semibold tracking-tight'>{title}</h2>
        <p className='text-muted-foreground text-sm leading-relaxed'>{when}</p>
      </header>
      <div className='space-y-8'>{children}</div>
    </section>
  )
}

/** A labelled stage holding one group of live examples. */
export function Specimen({
  label,
  note,
  children,
  className,
  bleed = false,
}: {
  label: string
  /** Muted aside after the label: the import path, a size, a caveat. */
  note?: ReactNode
  children: ReactNode
  className?: string
  /** Drop the stage padding (tables, page frames). */
  bleed?: boolean
}) {
  return (
    <div className='space-y-2.5'>
      <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
        <h3 className='text-sm font-medium'>{label}</h3>
        {note ? (
          <span className='text-muted-foreground text-xs'>{note}</span>
        ) : null}
      </div>
      <div
        className={cn(
          'bg-card rounded-xl border shadow-xs',
          bleed
            ? 'overflow-hidden'
            : 'flex flex-wrap items-center gap-3 p-4 sm:p-6',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** A mono caption under or beside an example: a token, a prop, a class. */
export function Code({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <code
      className={cn(
        'text-muted-foreground font-mono text-[11px] leading-tight',
        className
      )}
    >
      {children}
    </code>
  )
}

/** A captioned cell inside a specimen grid. */
export function Example({
  caption,
  children,
  className,
}: {
  caption: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-start gap-2', className)}>
      <div className='flex min-h-9 flex-wrap items-center gap-2'>
        {children}
      </div>
      <Code>{caption}</Code>
    </div>
  )
}

/** A house rule as a pair: what to do beside what not to do. */
export function DoDont({
  rule,
  why,
  doExample,
  doCaption,
  dontExample,
  dontCaption,
}: {
  rule: string
  why: ReactNode
  doExample: ReactNode
  doCaption: ReactNode
  dontExample: ReactNode
  dontCaption: ReactNode
}) {
  return (
    <div className='space-y-3'>
      <div className='space-y-1'>
        <h3 className='text-sm font-semibold'>{rule}</h3>
        <p className='text-muted-foreground max-w-2xl text-sm'>{why}</p>
      </div>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <DoDontCard kind='do' caption={doCaption}>
          {doExample}
        </DoDontCard>
        <DoDontCard kind='dont' caption={dontCaption}>
          {dontExample}
        </DoDontCard>
      </div>
    </div>
  )
}

function DoDontCard({
  kind,
  caption,
  children,
}: {
  kind: 'do' | 'dont'
  caption: ReactNode
  children: ReactNode
}) {
  const isDo = kind === 'do'
  return (
    <figure
      className={cn(
        'bg-card overflow-hidden rounded-xl border',
        isDo ? 'border-t-success border-t-2' : 'border-t-destructive border-t-2'
      )}
    >
      <div className='flex min-h-28 flex-wrap items-center gap-3 p-5'>
        {children}
      </div>
      <figcaption className='bg-muted/40 flex items-start gap-2 border-t px-5 py-3 text-sm'>
        {isDo ? (
          <Check className='text-success mt-0.5 size-4 shrink-0' aria-hidden />
        ) : (
          <X className='text-destructive mt-0.5 size-4 shrink-0' aria-hidden />
        )}
        <span>
          <span className='font-medium'>{isDo ? 'Do. ' : "Don't. "}</span>
          <span className='text-muted-foreground'>{caption}</span>
        </span>
      </figcaption>
    </figure>
  )
}
