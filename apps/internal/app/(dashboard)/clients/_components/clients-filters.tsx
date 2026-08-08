'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'

type ClientsFiltersProps = {
  search?: string
  /** Base path to push filter changes to — '/clients' or '/clients/archive'. */
  basePath: string
}

export function ClientsFilters({ search, basePath }: ClientsFiltersProps) {
  const { update } = useListParams({
    basePath,
    resetKeys: ['cursor', 'dir'],
    filters: {
      q: {},
    },
  })

  return (
    <FilterBar>
      <SearchInput
        value={search}
        onCommit={value => update({ q: value })}
        placeholder='Search clients…'
      />
    </FilterBar>
  )
}
