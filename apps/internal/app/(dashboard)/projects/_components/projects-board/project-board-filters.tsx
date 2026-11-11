'use client'

import { usePathname, useSearchParams } from 'next/navigation'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'

const FILTERS = { q: {} }
const SHALLOW_KEYS = ['q']

/**
 * The project board's filter bar, the same one every list and board starts
 * with. The board holds the whole project, so the search runs in the
 * browser and typing never reloads the page.
 */
export function ProjectBoardFilters() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { update, hasActiveFilters, reset } = useListParams({
    basePath: pathname,
    resetKeys: [],
    shallowKeys: SHALLOW_KEYS,
    filters: FILTERS,
  })

  return (
    <FilterBar
      search={
        <SearchInput
          value={searchParams.get('q') ?? undefined}
          onCommit={value => update({ q: value })}
          placeholder='Search tasks…'
        />
      }
      showReset={hasActiveFilters}
      onReset={reset}
    />
  )
}
