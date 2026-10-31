import type { ReactNode } from 'react'
import Link from 'next/link'
import { TriangleAlert, type LucideIcon } from 'lucide-react'

import { entityIconAccent } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

/**
 * One record in a sheet's list (a client's people, a company's clients,
 * people and leads, a contact's clients): a boxed row with an optional
 * icon, the name, one muted detail line and trailing actions. Every list
 * in a sheet uses it so they read the same. An entity icon from the
 * registry shows in that entity's colour. A row that holds form fields (a
 * title, a portal switch, a share) adds them under a hairline as label /
 * value rows (`RecordRowField`); text fields read as text until hovered or
 * focused (`RECORD_ROW_INPUT_CLASS`).
 */
export function SheetRecordRow({
  icon: Icon,
  leading,
  title,
  description,
  actions,
  onOpen,
  href,
  openLabel,
  fields,
  className,
}: {
  icon?: LucideIcon
  /** In place of the icon, e.g. a person's avatar. */
  leading?: ReactNode
  title: ReactNode
  /** One muted line under the title: an email, a status, "Pending save". */
  description?: ReactNode
  /** Trailing controls (star, remove), right-aligned. */
  actions?: ReactNode
  /**
   * Form fields on the record (`RecordRowField`s), as label / value rows
   * under a hairline.
   */
  fields?: ReactNode
  /** Makes the row's body a button that opens the record. */
  onOpen?: () => void
  /** Makes the row's body a link instead (a record that is a page, e.g. a project board). */
  href?: string
  /** Accessible name for the open button or link: "Open Acme". */
  openLabel?: string
  className?: string
}) {
  const body = (
    <>
      {leading ? (
        <span className='shrink-0'>{leading}</span>
      ) : Icon ? (
        <Icon
          className={cn(
            'size-4 shrink-0',
            entityIconAccent(Icon) ?? 'text-muted-foreground'
          )}
          aria-hidden
        />
      ) : null}
      <span className='flex min-w-0 flex-1 flex-col text-left text-sm leading-tight'>
        <span className='truncate font-medium'>{title}</span>
        {description ? (
          <span className='text-muted-foreground truncate text-xs'>
            {description}
          </span>
        ) : null}
      </span>
    </>
  )

  const openClassName =
    'focus-visible:ring-ring/50 -my-1.5 -ml-3 flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-stretch rounded-l-md py-1.5 pl-3 outline-none focus-visible:ring-2'

  const line = (
    <>
      {href ? (
        <Link href={href} aria-label={openLabel} className={openClassName}>
          {body}
        </Link>
      ) : onOpen ? (
        <button
          type='button'
          onClick={onOpen}
          aria-label={openLabel}
          className={openClassName}
        >
          {body}
        </button>
      ) : (
        <div className='flex min-w-0 flex-1 items-center gap-3'>{body}</div>
      )}
      {actions ? (
        <div className='flex shrink-0 items-center'>{actions}</div>
      ) : null}
    </>
  )

  const cardClassName = cn(
    'bg-muted/40 rounded-md border transition-colors',
    // Rows that open their record light up on hover, like table rows.
    (onOpen || href) && 'hover:bg-muted hover:border-foreground/20',
    className
  )
  const lineClassName = 'flex min-h-11 items-center gap-3 py-1.5 pr-1.5 pl-3'

  if (!fields) {
    return <div className={cn(lineClassName, cardClassName)}>{line}</div>
  }
  // Label and value: the name line, a hairline, then one row per field with
  // the labels in one column so they line up from card to card.
  return (
    <div
      className={cn('divide-border/60 flex flex-col divide-y', cardClassName)}
    >
      <div className={lineClassName}>{line}</div>
      <div className='grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-4 gap-y-0.5 px-3 py-2'>
        {fields}
      </div>
    </div>
  )
}

/**
 * A text field on a record row: reads as text until hovered or focused, when
 * its box appears. Use it for every input in `fields` (a title, a share).
 */
export const RECORD_ROW_INPUT_CLASS =
  'h-8 truncate border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent dark:hover:bg-input/30 placeholder:text-muted-foreground/70'

/**
 * One label / value row in a record card's fields: the label in the card's
 * label column ("Title", "Portal access", "Share"), the control after it. A
 * `grow` field (a text input) takes the value column's width, up to 288px.
 */
export function RecordRowField({
  label,
  grow = false,
  hint,
  children,
}: {
  label: string
  /**
   * What Save does with this field, right after the control: a small caution
   * icon and a short line ("Invite emailed when you save"). Use it in place
   * of a separate SaveSideEffect alert for a single field's side effect.
   */
  hint?: ReactNode
  /** A text input: fills the value column, up to 288px. */
  grow?: boolean
  children: ReactNode
}) {
  return (
    // `contents`: the label and the control are the grid's two cells. Not a
    // <label>: only the control responds to a click (it carries its own
    // aria-label), never the label text, the hint or the row's empty width.
    <div className='contents'>
      <span className='text-muted-foreground justify-self-start text-sm'>
        {label}
      </span>
      <span
        className={cn(
          'flex min-h-8 min-w-0 flex-wrap items-center gap-x-2 gap-y-1',
          grow ? 'w-full' : 'justify-self-start',
          // Ghost inputs keep their text on the value column's edge.
          grow && 'max-w-72 [&>*:last-child]:-ml-2 [&>*:last-child]:w-full'
        )}
      >
        {children}
        {hint ? (
          <span className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs'>
            <TriangleAlert
              className='text-warning size-3.5 shrink-0'
              aria-hidden
            />
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  )
}

/** The stack of SheetRecordRows. */
export function SheetRecordList({ children }: { children: ReactNode }) {
  return <div className='flex flex-col gap-2'>{children}</div>
}
