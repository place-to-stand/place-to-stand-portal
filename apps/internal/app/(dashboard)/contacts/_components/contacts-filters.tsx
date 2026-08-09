'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'

type ContactsFiltersProps = {
  search?: string
  /** Base path to push filter changes to — '/contacts' or '/contacts/archive'. */
  basePath: string
}

export function ContactsFilters({ search, basePath }: ContactsFiltersProps) {
  // Contacts tables paginate by offset, so `page` is the pagination key
  // cleared on every filter change (not cursor/dir).
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
        placeholder='Search contacts…'
      />
    </FilterBar>
  )
}
