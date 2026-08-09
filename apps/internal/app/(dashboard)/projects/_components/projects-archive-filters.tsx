'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'

type ProjectsArchiveFiltersProps = {
  search?: string
}

export function ProjectsArchiveFilters({ search }: ProjectsArchiveFiltersProps) {
  const { update } = useListParams({
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
    </FilterBar>
  )
}
