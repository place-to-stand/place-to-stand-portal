'use client'

import { useCallback, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { EmptyValue } from '@/components/table/empty-value'
import { cn } from '@/lib/utils'
import { entityIconAccent } from '@/lib/entity-accents'

export type LinkedRecordItem = {
  id: string
  label: string
  sublabel?: string | null
  /** Omit (with `onSelect`) to render the row as plain text. */
  href?: string
  /** For rows that open in place, e.g. a sheet over the current page. */
  onSelect?: () => void
  /** Rendered after the label, e.g. a status Badge. */
  trailing?: ReactNode
}

type LinkedRecordsHoverCellProps = {
  count: number
  /** Text after the number, e.g. ' active'. */
  label?: string
  /** Zero-state text; defaults to the shared dash (`EmptyValue`). */
  zeroLabel?: string
  /** Replaces the `count + label` trigger text, e.g. `(4 total)`. */
  triggerLabel?: string
  /**
   * Replaces the text trigger with custom content, e.g. a lone icon for a
   * single linked record (pair with `ariaLabel`).
   */
  trigger?: ReactNode
  items: LinkedRecordItem[]
  icon: LucideIcon
  /**
   * The icon's tint: the record's entity accent (`ENTITY_ACCENTS.*.icon`).
   * Defaults to muted.
   */
  iconClassName?: string
  /** Screen-reader name for the bare-number trigger, e.g. "3 clients". */
  ariaLabel?: string
  /** Controlled open state for coordinated cards (see useCoordinatedHoverCards). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Tone for the trigger text; defaults to `text-foreground`. */
  triggerClassName?: string
  /** Width overrides for the card; defaults to `w-auto min-w-56`. */
  contentClassName?: string
  align?: 'start' | 'center' | 'end'
  /**
   * Shows the row icon before the count, as list columns do (Projects on
   * Clients, Contacts on Companies). A zero then shows only a dash.
   */
  withIcon?: boolean
}

const TRIGGER_CLASS =
  'cursor-pointer border-b border-dotted border-current transition hover:border-solid outline-none focus-visible:rounded-sm focus-visible:ring-ring/50 focus-visible:ring-[3px]'
const ICON_TRIGGER_CLASS =
  'text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center rounded-sm transition outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]'
const ROW_CLASS = 'flex items-center gap-2 px-3 py-2 text-sm'

/**
 * A count that opens a HoverCard listing the records behind it — linked
 * clients on a contact, projects on a client, assignments on a user. Rows
 * link out when they carry an `href`; the zero state is a muted number with
 * no card.
 */
export function LinkedRecordsHoverCell({
  count,
  label,
  zeroLabel,
  triggerLabel,
  trigger,
  items,
  icon: Icon,
  iconClassName,
  ariaLabel,
  open,
  onOpenChange,
  triggerClassName,
  contentClassName,
  align = 'start',
  withIcon = false,
}: LinkedRecordsHoverCellProps) {
  // A zero is a dash with no icon, like every count column.
  if (count === 0) {
    return zeroLabel ? (
      <span className='text-muted-foreground/50'>{zeroLabel}</span>
    ) : (
      <EmptyValue />
    )
  }

  const card = (
    <HoverCard open={open} onOpenChange={onOpenChange}>
      <HoverCardTrigger asChild>
        <button
          type='button'
          aria-label={ariaLabel}
          className={
            trigger
              ? cn(ICON_TRIGGER_CLASS, triggerClassName)
              : cn(TRIGGER_CLASS, triggerClassName ?? 'text-foreground')
          }
        >
          {trigger ?? triggerLabel ?? `${count}${label ?? ''}`}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align={align}
        className={cn('w-auto min-w-56 p-0', contentClassName)}
      >
        <ul className='max-h-80 overflow-y-auto py-1'>
          {items.map(item => (
            <li key={item.id}>
              <LinkedRecordRow
                item={item}
                icon={Icon}
                iconClassName={iconClassName}
              />
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  )

  return withIcon ? (
    <span className='inline-flex items-center gap-2'>
      <Icon
        className={cn(
          iconClassName ?? entityIconAccent(Icon) ?? 'text-muted-foreground',
          'h-4 w-4 shrink-0'
        )}
        aria-hidden
      />
      {card}
    </span>
  ) : (
    card
  )
}

function LinkedRecordRow({
  item,
  icon: Icon,
  iconClassName,
}: {
  item: LinkedRecordItem
  icon: LucideIcon
  iconClassName?: string
}) {
  const content = (
    <>
      <Icon
        className={cn(
          iconClassName ?? entityIconAccent(Icon) ?? 'text-muted-foreground',
          'h-4 w-4 shrink-0'
        )}
      />
      <span className='min-w-0 flex-1'>
        <span className='block truncate'>{item.label}</span>
        {item.sublabel ? (
          <span className='text-muted-foreground block truncate text-xs'>
            {item.sublabel}
          </span>
        ) : null}
      </span>
      {item.trailing}
    </>
  )

  if (item.onSelect) {
    return (
      <button
        type='button'
        onClick={item.onSelect}
        className={cn(
          ROW_CLASS,
          'hover:bg-accent w-full cursor-pointer text-left transition-colors'
        )}
      >
        {content}
      </button>
    )
  }

  if (!item.href) {
    return <div className={ROW_CLASS}>{content}</div>
  }

  return (
    <Link
      href={item.href}
      className={cn(ROW_CLASS, 'hover:bg-accent transition-colors')}
    >
      {content}
    </Link>
  )
}

/**
 * Coordinates sibling hover cards so opening one force-closes the other —
 * the wrapper's 50ms open / 200ms close timers would otherwise show both for
 * ~150ms when sliding between adjacent triggers. A close only clears the
 * shared state if that card still owns it, so a stale close from the
 * previous card can't wipe the one that just opened.
 */
export function useCoordinatedHoverCards<Key extends string>() {
  const [openKey, setOpenKey] = useState<Key | null>(null)

  return useCallback(
    (key: Key) => ({
      open: openKey === key,
      onOpenChange: (next: boolean) =>
        setOpenKey(current => (next ? key : current === key ? null : current)),
    }),
    [openKey]
  )
}
