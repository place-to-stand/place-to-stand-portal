'use client'

import { usePathname, useSearchParams } from 'next/navigation'

import { PersonSelector } from '@/components/my-tasks/person-selector'
import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import type { DbUser } from '@/lib/types'

const FILTERS = { q: {}, assignee: {} }
const SHALLOW_KEYS = ['q', 'assignee']

/**
 * The project board's filter bar, the same one every list and board starts
 * with: search, then the person picker (everyone by default). The board
 * holds the whole project, so both run in the browser and never reload the
 * page.
 */
export function ProjectBoardFilters({
  people,
  currentUserId,
}: {
  people: DbUser[]
  currentUserId: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { update, hasActiveFilters, reset } = useListParams({
    basePath: pathname,
    resetKeys: [],
    shallowKeys: SHALLOW_KEYS,
    filters: FILTERS,
  })
  const assignee = searchParams.get('assignee') ?? 'all'

  return (
    <FilterBar
      search={
        <SearchInput
          value={searchParams.get('q') ?? undefined}
          onCommit={value => update({ q: value })}
          placeholder='Search tasks…'
        />
      }
      activeFilterCount={assignee === 'all' ? 0 : 1}
      showReset={hasActiveFilters}
      onReset={reset}
    >
      <PersonSelector
        admins={people}
        selectedUserId={assignee}
        currentUserId={currentUserId}
        onSelect={userId =>
          update({ assignee: userId === 'all' ? undefined : userId })
        }
      />
    </FilterBar>
  )
}
