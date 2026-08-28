'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { TableHead } from '@pts/ui/table'
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
  /** Header alignment — set 'center' to match a column whose cells are centered. */
  align?: 'left' | 'center'
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
  align = 'left',
}: SortableTableHeadProps) {
  const current = parseSort(sort, defaultSort)
  const isActive = current.field === field
  const defaultParsed = parseSort(undefined, defaultSort)

  const handleClick = () => {
    let next: SortValue | undefined = !isActive
      ? `${field}:asc`
      : current.direction === 'asc'
        ? `${field}:desc`
        : undefined

    // The click must always change the effective order:
    // - desc → clear would land right back on desc when this field IS the
    //   default-desc column (single-sort tables like submissions/hour
    //   blocks would be stuck) — flip to asc instead.
    // - an explicit value identical to the view default normalizes to a
    //   clean URL (param cleared).
    if (
      next === undefined &&
      defaultParsed.field === field &&
      defaultParsed.direction === 'desc'
    ) {
      next = `${field}:asc`
    } else if (next === defaultSort) {
      next = undefined
    }

    onSortChange(next)
  }

  // When the param is unset, the default column reads as sorted (PW3) —
  // expose that to AT too.
  const showAsSorted = isActive && (sort !== undefined || defaultParsed.field === field)

  // The cell carries `group/head` because that named group is what reveals
  // the neutral chevron below — it has to sit on an ancestor of the icon.
  return (
    <TableHead
      aria-sort={
        showAsSorted
          ? current.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : undefined
      }
      className={cn('group/head p-0', className)}
    >
      <button
        type='button'
        onClick={handleClick}
        className={cn(
          'hover:text-foreground flex h-full w-full cursor-pointer items-center gap-1 px-2 py-2 font-medium',
          align === 'center' ? 'justify-center text-center' : 'text-left'
        )}
      >
        {/* Centered heads get a mirror-width spacer so the label sits at
            true center — the sort icon on the right otherwise pushes it
            ~9px off-axis relative to the centered cell content below. */}
        {align === 'center' ? (
          <span aria-hidden className='size-3.5 shrink-0' />
        ) : null}
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
