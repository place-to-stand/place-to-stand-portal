'use client'

import { Children, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { FilterSheetButton } from './filter-sheet'
import { ResetFiltersButton } from './reset-filters-button'

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
 * From md up the filters and Reset sit inline after the search. Below md the
 * search keeps the row to itself beside a Filters button, and the filters
 * open in a sheet (`FilterSheetButton`) instead of stacking under it. The
 * inline copies sit in `md:contents` wrappers, so the md+ layout is the same
 * single flex row it always was.
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
  const hasFilters = Children.toArray(children).length > 0

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className='flex min-w-0 flex-1 md:contents max-md:[&>*]:w-full'>
        {search}
      </div>
      {hasFilters ? (
        <FilterSheetButton
          className='md:hidden'
          activeCount={activeFilterCount}
          onReset={onReset}
        >
          {children}
        </FilterSheetButton>
      ) : null}
      <div className={cn('md:contents', hasFilters && 'max-md:hidden')}>
        {children}
        {onReset ? (
          <ResetFiltersButton show={showReset} onReset={onReset} />
        ) : null}
      </div>
      {aside ? (
        <div className='ml-auto shrink-0 text-sm max-md:w-full'>{aside}</div>
      ) : null}
    </div>
  )
}
