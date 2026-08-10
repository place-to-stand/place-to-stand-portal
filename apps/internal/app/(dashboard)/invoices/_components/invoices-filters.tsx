'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { ResetFiltersButton } from '@/components/table-toolbar/reset-filters-button'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VALUES,
  isInvoiceStatus,
  type InvoiceStatusValue,
} from '@/lib/invoices/filters'

const STATUS_OPTIONS = INVOICE_STATUS_VALUES.map(value => ({
  value,
  label: INVOICE_STATUS_LABELS[value],
}))

type InvoicesFiltersProps = {
  status?: InvoiceStatusValue
  search?: string
  /** Route the filter state lives on — '/invoices' or '/invoices/archive'. */
  basePath: string
}

export function InvoicesFilters({
  status,
  search,
  basePath,
}: InvoicesFiltersProps) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      status: { isValid: value => isInvoiceStatus(value) },
      q: {},
    },
  })

  return (
    <FilterBar>
      <SearchInput
        value={search}
        onCommit={value => update({ q: value })}
        placeholder='Search invoices…'
      />
      <FilterSelect
        value={status}
        onChange={value => update({ status: value })}
        placeholder='All statuses'
        options={STATUS_OPTIONS}
      />
      <ResetFiltersButton show={hasActiveFilters} onReset={reset} />
    </FilterBar>
  )
}
