'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { ResetFiltersButton } from '@/components/table-toolbar/reset-filters-button'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'

type ProjectsArchiveFiltersProps = {
  search?: string
}

export function ProjectsArchiveFilters({ search }: ProjectsArchiveFiltersProps) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath: '/projects/archive',
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
        placeholder='Search projects…'
      />
      <ResetFiltersButton show={hasActiveFilters} onReset={reset} />
    </FilterBar>
  )
}
