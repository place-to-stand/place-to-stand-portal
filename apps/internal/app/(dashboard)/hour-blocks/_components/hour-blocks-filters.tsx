'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'

type HourBlocksFiltersProps = {
  search?: string
  /** Route the filter state lives on — '/hour-blocks' or '/hour-blocks/archive'. */
  basePath: string
}

export function HourBlocksFilters({ search, basePath }: HourBlocksFiltersProps) {
  const { update } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      q: {},
    },
  })

  return (
    <FilterBar>
      <SearchInput
        value={search}
        onCommit={value => update({ q: value })}
        placeholder='Search hour blocks…'
      />
    </FilterBar>
  )
}
