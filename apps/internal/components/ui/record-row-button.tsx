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
  className,
}: RecordRowButtonProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'hover:bg-muted/50 focus-visible:bg-muted/50 flex w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left outline-none',
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
