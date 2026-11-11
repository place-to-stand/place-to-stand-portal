'use client'

import { Children, useRef, useState, type ReactNode } from 'react'

import { RefreshSpinner } from '@/components/layout/list-refresh'
import { cn } from '@/lib/utils'

import { FilterSheetButton } from './filter-sheet'
import { ResetFiltersButton } from './reset-filters-button'
import { useFiltersFit } from './use-filters-fit'

type FilterBarProps = {
  /** The bar's SearchInput. */
  search: ReactNode
  /** The filter controls (FilterSelects). */
  children?: ReactNode
  /** Non-default filters, search excluded: the count on the phone button. */
  activeFilterCount?: number
  /** Whether Reset shows: any filter or the search differs from its default. */
  showReset?: boolean
  onReset?: () => void
  /**
   * Read-only summary pinned to the row's right end (a filtered total).
   * Wraps onto its own line below md.
   */
  aside?: ReactNode
  className?: string
}

/**
 * Toolbar row above a table: search + filters, unlabeled (PRD 004 §03, D5).
 * Sorting lives in the column headers, never here (D6).
 *
 * The filters and Reset sit inline after the search while they fit on one
 * line. When they don't (below md always, and on wider screens whenever the
 * bar is too narrow for them, `useFiltersFit`), the search keeps the row
 * beside a Filters button and the filters open in a sheet
 * (`FilterSheetButton`) instead of wrapping onto a second line. The inline
 * copies sit in `md:contents` wrappers, so the inline layout is one flex row.
 */
export function FilterBar({
  search,
  children,
  activeFilterCount = 0,
  showReset = false,
  onReset,
  aside,
  className,
}: FilterBarProps) {
  const filterCount = Children.toArray(children).length
  const hasFilters = filterCount > 0
  const barRef = useRef<HTMLDivElement>(null)
  const inlineRef = useRef<HTMLDivElement>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { folded, measured } = useFiltersFit(
    barRef,
    inlineRef,
    hasFilters,
    filterCount,
    sheetOpen
  )

  return (
    <div
      ref={barRef}
      data-slot='filter-bar'
      className={cn(
        'flex flex-wrap items-center gap-2',
        // Controls keep their own widths, so the measurement is true; and
        // until it has run the row stays on one line instead of showing
        // wrapped for a moment before it folds.
        'md:[&>*]:shrink-0 md:[&>*>*]:shrink-0',
        !measured && 'md:flex-nowrap md:overflow-hidden',
        className
      )}
    >
      <div
        className={cn(
          'flex min-w-0 flex-1 max-md:[&>*]:w-full',
          folded ? 'md:flex-none' : 'md:contents'
        )}
      >
        {search}
      </div>
      {hasFilters ? (
        <FilterSheetButton
          className={folded ? undefined : 'md:hidden'}
          activeCount={activeFilterCount}
          onReset={onReset}
          onOpenChange={setSheetOpen}
        >
          {children}
        </FilterSheetButton>
      ) : null}
      <div
        ref={inlineRef}
        className={cn(
          hasFilters && 'max-md:hidden',
          folded ? 'hidden' : 'md:contents'
        )}
      >
        {children}
        {onReset ? (
          <ResetFiltersButton show={showReset} onReset={onReset} />
        ) : null}
      </div>
      {aside ? (
        <div className='ml-auto shrink-0 text-sm max-md:w-full'>{aside}</div>
      ) : null}
      {/* The panel's top right, while the list reloads. */}
      <RefreshSpinner className={cn(!aside && 'ml-auto')} />
    </div>
  )
}
