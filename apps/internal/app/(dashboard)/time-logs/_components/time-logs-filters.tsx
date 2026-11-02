'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { FILTER_TRIGGER_WIDTH } from '@/components/ui/field-trigger'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { useListParams } from '@/hooks/use-list-params'
import { isAllTimeRange } from '@/lib/dates/calendar-date'
import type { TimeLogsListParams } from '@/lib/time-logs/filters'

type TimeLogsFiltersProps = {
  /** The list these filters drive: `/time-logs` or `/time-logs/archive`. */
  basePath: '/time-logs' | '/time-logs/archive'
  params: TimeLogsListParams
  clients: SearchableComboboxItem[]
  projects: SearchableComboboxItem[]
  people: SearchableComboboxItem[]
}

/**
 * Search (note, person, project, client, task), then date range (All time by
 * default), client, project and person. Changing the client clears a project
 * from another client. The filtered hours total sits in the table footer.
 */
export function TimeLogsFilters({
  basePath,
  params,
  clients,
  projects,
  people,
}: TimeLogsFiltersProps) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      q: {},
      from: {},
      to: {},
      companyId: {},
      projectId: {},
      personId: {},
    },
  })

  const activeCount =
    (params.isDefaultRange ? 0 : 1) +
    [params.companyId, params.projectId, params.personId].filter(Boolean).length

  return (
    <FilterBar
      search={
        <SearchInput
          value={params.q ?? ''}
          onCommit={value => update({ q: value })}
          placeholder='Search time logs…'
        />
      }
      activeFilterCount={activeCount}
      showReset={hasActiveFilters}
      onReset={reset}
    >
      <DateRangePicker
        className={FILTER_TRIGGER_WIDTH}
        isDefault={params.isDefaultRange}
        onClear={() => update({ from: undefined, to: undefined })}
        value={{ from: params.from, to: params.to }}
        onChange={range =>
          update(
            isAllTimeRange(range)
              ? { from: undefined, to: undefined }
              : { from: range.from, to: range.to }
          )
        }
      />
      <SearchableCombobox
        className={FILTER_TRIGGER_WIDTH}
        ariaLabel='Client'
        items={clients}
        value={params.companyId ?? ''}
        onChange={value =>
          update({ companyId: value || undefined, projectId: undefined })
        }
        onClear={() => update({ companyId: undefined, projectId: undefined })}
        placeholder='All clients'
        searchPlaceholder='Search clients…'
        emptyMessage='No clients found.'
      />
      <SearchableCombobox
        className={FILTER_TRIGGER_WIDTH}
        ariaLabel='Project'
        items={projects}
        value={params.projectId ?? ''}
        onChange={value => update({ projectId: value || undefined })}
        onClear={() => update({ projectId: undefined })}
        placeholder='All projects'
        searchPlaceholder='Search projects…'
        emptyMessage='No projects found.'
      />
      <SearchableCombobox
        className={FILTER_TRIGGER_WIDTH}
        ariaLabel='Person'
        items={people}
        value={params.personId ?? ''}
        onChange={value => update({ personId: value || undefined })}
        onClear={() => update({ personId: undefined })}
        placeholder='Everyone'
        searchPlaceholder='Search people…'
        emptyMessage='No one found.'
      />
    </FilterBar>
  )
}
