'use client'

import { useEffect } from 'react'

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
    filters: { from: {}, to: {}, clientId: {}, projectId: {}, personId: {} },
  })

  // The server picks "this month" in its own timezone. Near a month's
  // turn that can differ from the viewer's; when it does, pin the viewer's
  // month in the URL so the list and the picker agree.
  const serverFrom = params.isDefaultRange ? params.from : null
  useEffect(() => {
    if (!serverFrom) return
    const local = currentMonthRange()
    if (local.from !== serverFrom) update({ from: local.from, to: local.to })
  }, [serverFrom, update])

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
          update({ clientId: value || undefined, projectId: undefined })
        }
        onClear={() => update({ clientId: undefined, projectId: undefined })}
        placeholder='All clients'
        searchPlaceholder='Search clients…'
        emptyMessage='No clients found.'
      />
      <SearchableCombobox
        className='w-52'
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
        className='w-48'
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
