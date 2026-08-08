'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SortValue = `${string}:${'asc' | 'desc'}`

type SortableTableHeadProps = {
  /** Allowlisted sort field this column controls. */
  field: string
  /** Current validated `?sort=` value (undefined = view default). */
  sort: string | undefined
  /** The view's default sort, e.g. 'name:asc' — its column shows the arrow on load (PW3). */
  defaultSort: SortValue
  /** Receives the next `?sort=` value; undefined = back to default (URL param cleared). */
  onSortChange: (next: SortValue | undefined) => void
  children: ReactNode
  className?: string
}

function parseSort(value: string | undefined, fallback: SortValue) {
  const raw = value ?? fallback
  const [field, direction] = raw.split(':')
  return {
    field,
    direction: direction === 'desc' ? ('desc' as const) : ('asc' as const),
  }
}

/**
 * Column-header sort control (PRD 004 §03, D6 revised). Only allowlisted
 * columns render this — plain `TableHead` elsewhere IS the allowlist.
 * Click cycles asc → desc → default; the default-sorted column always
 * shows its direction arrow (PW3).
 */
export function SortableTableHead({
  field,
  sort,
  defaultSort,
  onSortChange,
  children,
  className,
}: SortableTableHeadProps) {
  const current = parseSort(sort, defaultSort)
  const isActive = current.field === field
  const defaultParsed = parseSort(undefined, defaultSort)

  const handleClick = () => {
    if (!isActive) {
      onSortChange(`${field}:asc`)
      return
    }
    if (current.direction === 'asc') {
      onSortChange(`${field}:desc`)
      return
    }
    // desc → back to the view default (clears the param). If this field IS
    // the default field, that lands on its default direction.
    onSortChange(undefined)
  }

  // When the param is unset, the default column reads as sorted (PW3) —
  // expose that to AT too.
  const showAsSorted = isActive && (sort !== undefined || defaultParsed.field === field)

  return (
    <TableHead
      aria-sort={
        showAsSorted
          ? current.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : undefined
      }
      className={cn('p-0', className)}
    >
      <button
        type='button'
        onClick={handleClick}
        className='hover:text-foreground flex h-full w-full cursor-pointer items-center gap-1 px-2 py-2 text-left font-medium'
      >
        <span>{children}</span>
        {showAsSorted ? (
          current.direction === 'asc' ? (
            <ArrowUp className='size-3.5 shrink-0' />
          ) : (
            <ArrowDown className='size-3.5 shrink-0' />
          )
        ) : (
          <ChevronsUpDown className='text-muted-foreground/50 size-3.5 shrink-0 opacity-0 transition-opacity group-hover/head:opacity-100' />
        )}
      </button>
    </TableHead>
  )
}
