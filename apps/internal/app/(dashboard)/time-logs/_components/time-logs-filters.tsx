'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { useListParams } from '@/hooks/use-list-params'
import {
  currentMonthRange,
  type TimeLogsListParams,
} from '@/lib/time-logs/filters'

const HOURS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

type TimeLogsFiltersProps = {
  /** The list these filters drive: `/time-logs` or `/time-logs/archive`. */
  basePath: '/time-logs' | '/time-logs/archive'
  params: TimeLogsListParams
  clients: SearchableComboboxItem[]
  projects: SearchableComboboxItem[]
  people: SearchableComboboxItem[]
  /** Hours across every page of the filtered logs, shown at the row's end. */
  totalHours: number
}

/**
 * Date range (this month by default), client, project and person, with the
 * filtered hours total at the row's right end. Changing the client clears a
 * project from another client; picking this month clears the dates back to
 * the default.
 */
export function TimeLogsFilters({
  basePath,
  params,
  clients,
  projects,
  people,
  totalHours,
}: TimeLogsFiltersProps) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: { from: {}, to: {}, client: {}, project: {}, person: {} },
  })

  const activeCount =
    (params.isDefaultRange ? 0 : 1) +
    [params.clientId, params.projectId, params.personId].filter(Boolean).length

  return (
    <FilterBar
      search={null}
      activeFilterCount={activeCount}
      showReset={hasActiveFilters}
      onReset={reset}
      aside={
        <p className='max-md:text-right'>
          <span className='text-muted-foreground'>Total: </span>
          <span className='font-semibold tabular-nums'>
            {HOURS.format(totalHours)} hrs
          </span>
        </p>
      }
    >
      <DateRangePicker
        value={{ from: params.from, to: params.to }}
        onChange={range => {
          const isDefault =
            range.from === currentMonthRange().from &&
            range.to === currentMonthRange().to
          update(
            isDefault
              ? { from: undefined, to: undefined }
              : { from: range.from, to: range.to }
          )
        }}
      />
      <SearchableCombobox
        className='w-52'
        ariaLabel='Client'
        items={clients}
        value={params.clientId ?? ''}
        onChange={value =>
          update({ client: value || undefined, project: undefined })
        }
        onClear={() => update({ client: undefined, project: undefined })}
        placeholder='All clients'
        searchPlaceholder='Search clients…'
        emptyMessage='No clients found.'
      />
      <SearchableCombobox
        className='w-52'
        ariaLabel='Project'
        items={projects}
        value={params.projectId ?? ''}
        onChange={value => update({ project: value || undefined })}
        onClear={() => update({ project: undefined })}
        placeholder='All projects'
        searchPlaceholder='Search projects…'
        emptyMessage='No projects found.'
      />
      <SearchableCombobox
        className='w-48'
        ariaLabel='Person'
        items={people}
        value={params.personId ?? ''}
        onChange={value => update({ person: value || undefined })}
        onClear={() => update({ person: undefined })}
        placeholder='Everyone'
        searchPlaceholder='Search people…'
        emptyMessage='No one found.'
      />
    </FilterBar>
  )
}
