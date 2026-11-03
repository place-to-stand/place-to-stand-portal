import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * The one panel surface on a page: every list, report card, board column and
 * home widget sits on it. Use `PagePanel`; reach for the class only where the
 * element must be something other than a `<section>` (a dnd column, a grid).
 */
export const pagePanelClass = 'bg-background rounded-xl border shadow-sm'

type PagePanelProps = ComponentProps<'section'> & {
  /** No inner padding: for panels whose rows or header run edge to edge. */
  flush?: boolean
}

export function PagePanel({
  flush = false,
  className,
  ...props
}: PagePanelProps) {
  return (
    <section
      data-slot='page-panel'
      className={cn(pagePanelClass, !flush && 'p-4', className)}
      {...props}
    />
  )
}
