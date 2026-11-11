'use client'

import type { ComponentProps } from 'react'

import { PersonSelector } from '@/components/my-tasks/person-selector'
import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import { LEAD_SOURCE_LABELS, LEAD_SOURCE_TYPES } from '@/lib/leads/constants'
import { UUID_PATTERN } from '@/lib/sheets/entities'

import { isLeadSourceType } from '../_lib/board-filters'

const SOURCE_OPTIONS = LEAD_SOURCE_TYPES.map(value => ({
  value,
  label: LEAD_SOURCE_LABELS[value],
}))

/** Search over the board's leads, then owner and source (PRD 004 §03). */
export function LeadsBoardFilters({
  search,
  source,
  assigneeFilter,
  viewerId,
  people,
}: {
  search?: string
  source?: string
  /** A user id or `'all'`; the viewer's own id is the default. */
  assigneeFilter: string
  viewerId: string
  people: ComponentProps<typeof PersonSelector>['admins']
}) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath: '/leads',
    resetKeys: [],
    // The board holds every lead, so search and source filter in the
    // browser; the owner picker still reloads, as on My tasks.
    shallowKeys: ['q', 'source'],
    filters: {
      q: {},
      source: { isValid: isLeadSourceType },
      assignee: {
        isValid: value => value === 'all' || UUID_PATTERN.test(value),
        defaultValue: viewerId,
      },
    },
  })

  return (
    <FilterBar
      search={
        <SearchInput
          value={search}
          onCommit={value => update({ q: value })}
          placeholder='Search leads…'
        />
      }
      activeFilterCount={
        (assigneeFilter !== viewerId ? 1 : 0) + (source ? 1 : 0)
      }
      showReset={hasActiveFilters}
      onReset={reset}
    >
      <PersonSelector
        admins={people}
        selectedUserId={assigneeFilter}
        currentUserId={viewerId}
        allLabel='All leads'
      />
      <FilterSelect
        value={source}
        onChange={value => update({ source: value })}
        placeholder='All sources'
        options={SOURCE_OPTIONS}
      />
    </FilterBar>
  )
}
