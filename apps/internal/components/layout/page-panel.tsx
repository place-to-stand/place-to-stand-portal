import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

import { RefreshSpinner } from './list-refresh'

/**
 * The one panel surface on a page: every list, board, report card and
 * home widget sits on it. Use `PagePanel`; reach for the class only where the
 * element must be something other than a `<section>` (a grid).
 */
export const pagePanelClass = 'bg-background rounded-xl border shadow-sm'

type PagePanelProps = ComponentProps<'section'> & {
  /** No inner padding: for panels whose rows or header run edge to edge. */
  flush?: boolean
}

export function PagePanel({
  flush = false,
  className,
  children,
  ...props
}: PagePanelProps) {
  return (
    <section
      data-slot='page-panel'
      className={cn(
        pagePanelClass,
        'group/panel relative',
        !flush && 'p-4',
        className
      )}
      {...props}
    >
      {/* While the page's data reloads. A filter bar shows its own at the
          row's end; a flush panel's top right belongs to its table header.
          First, so it never turns the real last child into a spaced one
          under `space-y-*`. */}
      {flush ? null : (
        <RefreshSpinner className='absolute top-4 right-4 group-has-[[data-slot=filter-bar]]/panel:hidden' />
      )}
      {children}
    </section>
  )
}
