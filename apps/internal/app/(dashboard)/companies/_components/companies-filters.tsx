'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'

export function CompaniesFilters({
  search,
  basePath,
}: {
  search?: string
  basePath: string
}) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: [],
    filters: { q: {} },
  })

  return (
    <FilterBar
      search={
        <SearchInput
          value={search}
          onCommit={value => update({ q: value })}
          placeholder='Search companies…'
        />
      }
      activeFilterCount={0}
      showReset={hasActiveFilters}
      onReset={reset}
    />
  )
}
