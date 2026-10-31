'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { FILTER_TRIGGER_WIDTH } from '@/components/ui/field-trigger'
import { useListParams } from '@/hooks/use-list-params'
import { isAllTimeRange } from '@/lib/dates/calendar-date'
import {
  HOUR_BLOCK_INVOICE_LABELS,
  HOUR_BLOCK_INVOICE_VALUES,
  isHourBlockInvoiceFilter,
  type HourBlockInvoiceFilter,
} from '@/lib/settings/hour-blocks/filters'

const INVOICE_OPTIONS = HOUR_BLOCK_INVOICE_VALUES.map(value => ({
  value,
  label: HOUR_BLOCK_INVOICE_LABELS[value],
}))

type HourBlocksFiltersProps = {
  search?: string
  companyId?: string
  invoice?: HourBlockInvoiceFilter
  /** Created between, `YYYY-MM-DD`; none is All time (the default). */
  from?: string
  to?: string
  clients: ReadonlyArray<{ id: string; name: string }>
  /** Route the filter state lives on — '/hour-blocks' or '/hour-blocks/archive'. */
  basePath: string
}

/**
 * Search, then the block's client, the invoice it came from, and when it
 * was created (All time by default).
 */
export function HourBlocksFilters({
  search,
  companyId,
  invoice,
  from,
  to,
  clients,
  basePath,
}: HourBlocksFiltersProps) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      q: {},
      companyId: {},
      invoice: { isValid: isHourBlockInvoiceFilter },
      from: {},
      to: {},
    },
  })

  const isAllTime = !from && !to

  return (
    <FilterBar
      search={
        <SearchInput
          value={search}
          onCommit={value => update({ q: value })}
          placeholder='Search hour blocks…'
        />
      }
      activeFilterCount={
        (companyId ? 1 : 0) + (invoice ? 1 : 0) + (isAllTime ? 0 : 1)
      }
      showReset={hasActiveFilters}
      onReset={reset}
    >
      <DateRangePicker
        className={FILTER_TRIGGER_WIDTH}
        isDefault={isAllTime}
        onClear={() => update({ from: undefined, to: undefined })}
        value={{ from: from ?? '', to: to ?? '' }}
        onChange={range =>
          update(
            isAllTimeRange(range)
              ? { from: undefined, to: undefined }
              : { from: range.from, to: range.to }
          )
        }
      />
      <FilterSelect
        value={companyId}
        onChange={value => update({ companyId: value })}
        placeholder='All clients'
        options={clients.map(client => ({
          value: client.id,
          label: client.name,
        }))}
      />
      <FilterSelect
        value={invoice}
        onChange={value => update({ invoice: value })}
        placeholder='Any invoice'
        options={INVOICE_OPTIONS}
      />
    </FilterBar>
  )
}
