'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import {
  COMPANY_LEADS_LABELS,
  COMPANY_LEADS_VALUES,
  COMPANY_TYPE_LABELS,
  COMPANY_TYPE_VALUES,
  isCompanyLeads,
  isCompanyType,
  type CompanyLeadsFilter,
  type CompanyTypeFilter,
} from '@/lib/companies/filters'

const TYPE_OPTIONS = COMPANY_TYPE_VALUES.map(value => ({
  value,
  label: COMPANY_TYPE_LABELS[value],
}))
const LEADS_OPTIONS = COMPANY_LEADS_VALUES.map(value => ({
  value,
  label: COMPANY_LEADS_LABELS[value],
}))

export function CompaniesFilters({
  search,
  type,
  leads,
  basePath,
}: {
  search?: string
  type?: CompanyTypeFilter
  leads?: CompanyLeadsFilter
  basePath: string
}) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: [],
    filters: {
      q: {},
      type: { isValid: isCompanyType },
      leads: { isValid: isCompanyLeads },
    },
  })

  return (
    <FilterBar
      search={
        <SearchInput
          value={search}
          onCommit={value => update({ q: value })}
          placeholder='Search companies…'
        />
      }
      activeFilterCount={(type ? 1 : 0) + (leads ? 1 : 0)}
      showReset={hasActiveFilters}
      onReset={reset}
    >
      <FilterSelect
        value={type}
        onChange={value => update({ type: value })}
        placeholder='All companies'
        options={TYPE_OPTIONS}
      />
      <FilterSelect
        value={leads}
        onChange={value => update({ leads: value })}
        placeholder='Open leads: any'
        options={LEADS_OPTIONS}
      />
    </FilterBar>
  )
}
