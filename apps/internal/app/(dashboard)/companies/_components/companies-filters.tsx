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

// Clients have their own tab, so the menu only narrows to the rest.
const TYPE_OPTIONS = COMPANY_TYPE_VALUES.filter(
  value => value !== 'client'
).map(value => ({ value, label: COMPANY_TYPE_LABELS[value] }))
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
  // On the Clients tab, type=client is the tab, not a filter: Reset keeps it.
  const onClientsTab = type === 'client'
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: onClientsTab
      ? { q: {}, leads: { isValid: isCompanyLeads } }
      : {
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
      activeFilterCount={(type && !onClientsTab ? 1 : 0) + (leads ? 1 : 0)}
      showReset={hasActiveFilters}
      onReset={reset}
    >
      {onClientsTab ? null : (
        <FilterSelect
          value={type}
          onChange={value => update({ type: value })}
          placeholder='All companies'
          options={TYPE_OPTIONS}
        />
      )}
      <FilterSelect
        value={leads}
        onChange={value => update({ leads: value })}
        placeholder='Open leads: any'
        options={LEADS_OPTIONS}
      />
    </FilterBar>
  )
}
