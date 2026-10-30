import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * One record in a sheet's list (a client's people, a company's clients,
 * people and leads, a contact's clients): a boxed row with an optional
 * icon, the name, one muted detail line and trailing actions. Every list
 * in a sheet uses it so they read the same. A row that holds form fields
 * (a title, a portal switch, a share) puts them on a second line inside the
 * card, each a `RecordRowField` with its label on the left.
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
   * Form fields on the record (`RecordRowField`s), on a second line inside
   * the card, under the name.
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
        <Icon className='text-muted-foreground size-4 shrink-0' aria-hidden />
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
  return (
    <div className={cn('flex flex-col', cardClassName)}>
      <div className={lineClassName}>{line}</div>
      {/* Under the name (past the icon), the same on every card. */}
      <div className='flex flex-wrap items-center gap-x-6 gap-y-2 pr-3 pb-2.5 pl-10'>
        {fields}
      </div>
    </div>
  )
}

/**
 * One form field on a record row's second line: a visible label on the
 * left ("Title", "Portal", "Share"), the control after it. Labels share
 * one width so fields line up from card to card.
 */
export function RecordRowField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className='flex items-center gap-2'>
      <span className='text-muted-foreground w-10 shrink-0 text-xs'>
        {label}
      </span>
      {children}
    </label>
  )
}

/** The stack of SheetRecordRows. */
export function SheetRecordList({ children }: { children: ReactNode }) {
  return <div className='flex flex-col gap-2'>{children}</div>
}
