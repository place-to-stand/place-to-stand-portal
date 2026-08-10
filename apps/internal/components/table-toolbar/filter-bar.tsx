import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Toolbar row above a table: search + filters, unlabeled (PRD 004 §03, D5).
 * Sorting lives in the column headers, never here (D6).
 */
export function FilterBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center',
        className
      )}
    >
      {children}
    </div>
  )
}
