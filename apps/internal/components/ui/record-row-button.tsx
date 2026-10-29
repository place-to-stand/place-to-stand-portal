'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type RecordRowButtonProps = {
  title: ReactNode
  /** Muted second line, e.g. "Acme · Proposal sent". */
  subtitle?: ReactNode
  /** Before the text, e.g. an unread dot. */
  leading?: ReactNode
  /** Right-aligned, e.g. a status badge or a due date. */
  trailing?: ReactNode
  onClick: () => void
  /** `bleed` fills the row edge to edge (widget lists); `inset` is rounded (sheet lists). */
  variant?: 'bleed' | 'inset'
  className?: string
}

/**
 * A clickable row in a list of records (tasks, leads, contacts,
 * notifications): bold title, optional muted subtitle, optional leading and
 * trailing slots. Clicking usually opens the record's sheet.
 */
export function RecordRowButton({
  title,
  subtitle,
  leading,
  trailing,
  onClick,
  variant = 'bleed',
  className,
}: RecordRowButtonProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'hover:bg-muted/50 focus-visible:bg-muted/50 flex w-full min-w-0 items-center gap-3 text-left outline-none',
        variant === 'bleed' ? 'px-4 py-2.5' : 'rounded-md px-2 py-2',
        className
      )}
    >
      {leading}
      <span className='min-w-0 flex-1'>
        <span
          className='block truncate text-sm font-medium'
          title={typeof title === 'string' ? title : undefined}
        >
          {title}
        </span>
        {subtitle ? (
          <span
            className='text-muted-foreground block truncate text-xs'
            title={typeof subtitle === 'string' ? subtitle : undefined}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
      {trailing}
    </button>
  )
}
