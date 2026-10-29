import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * One record in a sheet's list (a client's people, a company's clients,
 * people and leads, a contact's clients): a boxed row with an optional
 * icon, the name, one muted detail line and trailing actions. Every list
 * in a sheet uses it so they read the same.
 */
export function SheetRecordRow({
  icon: Icon,
  title,
  description,
  actions,
  onOpen,
  openLabel,
  className,
}: {
  icon?: LucideIcon
  title: ReactNode
  /** One muted line under the title: an email, a status, "Pending save". */
  description?: ReactNode
  /** Trailing controls (star, remove), right-aligned. */
  actions?: ReactNode
  /** Makes the row's body a button that opens the record. */
  onOpen?: () => void
  /** Accessible name for the open button: "Open Acme". */
  openLabel?: string
  className?: string
}) {
  const body = (
    <>
      {Icon ? (
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

  return (
    <div
      className={cn(
        'bg-muted/40 flex min-h-11 items-center gap-3 rounded-md border py-1.5 pr-1.5 pl-3',
        className
      )}
    >
      {onOpen ? (
        <button
          type='button'
          onClick={onOpen}
          aria-label={openLabel}
          className='hover:text-foreground focus-visible:ring-ring/50 -my-1.5 -ml-3 flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-l-md py-1.5 pl-3 outline-none hover:underline focus-visible:ring-2'
        >
          {body}
        </button>
      ) : (
        <div className='flex min-w-0 flex-1 items-center gap-3'>{body}</div>
      )}
      {actions ? (
        <div className='flex shrink-0 items-center'>{actions}</div>
      ) : null}
    </div>
  )
}

/** The stack of SheetRecordRows. */
export function SheetRecordList({ children }: { children: ReactNode }) {
  return <div className='flex flex-col gap-2'>{children}</div>
}
