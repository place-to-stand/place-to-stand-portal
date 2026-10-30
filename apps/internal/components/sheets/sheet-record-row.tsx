import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { entityIconAccent } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

/**
 * One record in a sheet's list (a client's people, a company's clients,
 * people and leads, a contact's clients): a boxed row with an optional
 * icon, the name, one muted detail line and trailing actions. Every list
 * in a sheet uses it so they read the same. An entity icon from the
 * registry shows in that entity's colour. A row that holds form fields (a
 * title, a portal switch, a share) puts them under a hairline in one row
 * aligned with the name, each a `RecordRowField` with its label beside it;
 * the row wraps on narrow sheets.
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
   * Form fields on the record (`RecordRowField`s), under a hairline in one
   * row aligned with the name.
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
  return (
    <div className={cn('flex flex-col', cardClassName)}>
      <div className={lineClassName}>{line}</div>
      {/* Under a hairline, one row aligned with the name (past the icon);
          wraps on narrow sheets. */}
      <div className='border-border/70 flex flex-wrap items-center gap-x-6 gap-y-2 border-t py-2 pr-3 pl-10'>
        {fields}
      </div>
    </div>
  )
}

/**
 * One form field on a record row's fields line: its label right beside the
 * control ("Title", "Portal access", "Share"). A `grow` field (a text input)
 * takes the free width; the others keep their own.
 */
export function RecordRowField({
  label,
  grow = false,
  children,
}: {
  label: string
  /** Stretch to fill the row (text inputs). */
  grow?: boolean
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        'flex min-w-0 items-center gap-2',
        grow && 'min-w-48 flex-1 [&>*:last-child]:flex-1'
      )}
    >
      <span className='text-muted-foreground shrink-0 text-sm'>{label}</span>
      {children}
    </label>
  )
}

/** The stack of SheetRecordRows. */
export function SheetRecordList({ children }: { children: ReactNode }) {
  return <div className='flex flex-col gap-2'>{children}</div>
}
