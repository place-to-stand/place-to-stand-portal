import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** The shared frame for home widgets: titled header, meta/action slot, body. Same background as the card that holds list-page tables (bg-background). */
export function WidgetCard({
  id,
  title,
  meta,
  action,
  titleAddon,
  children,
  className,
}: {
  id: string
  title: string
  meta?: ReactNode
  action?: ReactNode
  /** Beside the title on the left (e.g. a view toggle); `action` stays right. */
  titleAddon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'bg-background flex flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby={`${id}-heading`}
    >
      <header className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5'>
        <div className='flex items-center gap-3'>
          <h2 id={`${id}-heading`} className='text-sm font-semibold'>
            {title}
          </h2>
          {titleAddon}
        </div>
        <div className='ml-auto flex items-center gap-2'>
          {meta ? (
            <p className='text-muted-foreground text-xs font-medium'>{meta}</p>
          ) : null}
          {action}
        </div>
      </header>
      <div className='flex-1'>{children}</div>
    </section>
  )
}
