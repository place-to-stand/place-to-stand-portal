'use client'

import { useCallback } from 'react'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import {
  getProjectStatusToken,
  PROJECT_STATUS_OPTIONS,
  type ProjectStatusValue,
} from '@/lib/constants'

import {
  DEFAULT_STATUS_FILTER,
  DEFAULT_STATUS_FILTER_PARAM,
  isProjectStatusValue,
  STATUS_FILTER_NONE,
} from '../_lib/parse-projects-search-params'

const STATUS_OPTIONS = PROJECT_STATUS_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
  badgeClassName: getProjectStatusToken(option.value),
}))

type ProjectsLandingFiltersProps = {
  statuses: ProjectStatusValue[]
  search?: string
}

/**
 * Landing toolbar (PRD 004 §03, D6/R2): governs all three project sections.
 * URL semantics: no param = DEFAULT_STATUS_FILTER, `?status=none` =
 * explicitly cleared, otherwise comma-joined; the implicit default never
 * counts as an active filter.
 */
export function ProjectsLandingFilters({
  statuses,
  search,
}: ProjectsLandingFiltersProps) {
  const { update, getParam } = useListParams({
    basePath: '/projects',
    resetKeys: [],
    filters: {
      status: {
        defaultValue: DEFAULT_STATUS_FILTER_PARAM,
        isValid: value =>
          value === STATUS_FILTER_NONE ||
          value.split(',').some(isProjectStatusValue),
      },
      q: {},
    },
  })

  const handleStatusChange = useCallback(
    (values: string[]) => {
      const nextStatuses = values.filter(isProjectStatusValue)

      if (nextStatuses.length === 0) {
        // 'none' sentinel represents an explicitly cleared selection.
        update({ status: STATUS_FILTER_NONE })
        return
      }

      const isDefault =
        nextStatuses.length === DEFAULT_STATUS_FILTER.length &&
        DEFAULT_STATUS_FILTER.every(status => nextStatuses.includes(status))
      const hasInteracted = getParam('status') !== undefined

      if (isDefault && !hasInteracted) {
        // Keep the clean landing URL until the user starts interacting.
        update({ status: undefined })
        return
      }

      update({ status: nextStatuses.join(',') })
    },
    [getParam, update]
  )

  return (
    <FilterBar>
      <SearchInput
        value={search}
        onCommit={value => update({ q: value })}
        placeholder='Search projects…'
      />
      <FilterSelect
        mode='multi'
        values={statuses}
        onChange={handleStatusChange}
        placeholder='Status'
        options={STATUS_OPTIONS}
      />
    </FilterBar>
  )
}
