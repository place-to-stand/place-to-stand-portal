'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import { TagBadge } from '@/components/tags/tag-badge'
import { useTagOptions } from '@/components/tags/use-tag-options'
import { tagKey } from '@/lib/tags/names'
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

// Clients also have their own tab; the filter offers both sides anyway.
const TYPE_OPTIONS = COMPANY_TYPE_VALUES.map(value => ({
  value,
  label: COMPANY_TYPE_LABELS[value],
}))
const LEADS_OPTIONS = COMPANY_LEADS_VALUES.map(value => ({
  value,
  label: COMPANY_LEADS_LABELS[value],
}))

export function CompaniesFilters({
  mode,
  search,
  type,
  leads,
  tags,
  basePath,
}: {
  mode: 'active' | 'clients' | 'archive'
  search?: string
  type?: CompanyTypeFilter
  leads?: CompanyLeadsFilter
  tags: string[]
  basePath: string
}) {
  // The Clients page lists clients only, so it has no Client filter.
  const onClientsTab = mode === 'clients'
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: onClientsTab
      ? { q: {}, leads: { isValid: isCompanyLeads }, tags: {} }
      : {
          q: {},
          type: { isValid: isCompanyType },
          leads: { isValid: isCompanyLeads },
          tags: {},
        },
  })
  // The tags live companies use (counts cover live companies only, so the
  // archive also offers tags only archived companies carry). A tag in the link that isn't offered still
  // shows, so it can be cleared.
  const { data: tagOptions = [] } = useTagOptions('company')
  const archive = mode === 'archive'
  const offered = archive
    ? tagOptions
    : tagOptions.filter(option => option.count > 0)
  const tagFilterOptions = [
    ...offered,
    ...tags
      .filter(name => !offered.some(o => tagKey(o.name) === tagKey(name)))
      .map(name => ({ id: name, name, count: 0 })),
  ].map(option => ({
    value: option.name,
    label: option.name,
    badge: <TagBadge name={option.name} />,
  }))
  const pickedTags = tagFilterOptions
    .filter(option => tags.some(name => tagKey(name) === tagKey(option.value)))
    .map(option => option.value)

  return (
    <FilterBar
      search={
        <SearchInput
          value={search}
          onCommit={value => update({ q: value })}
          placeholder='Search companies…'
        />
      }
      activeFilterCount={
        (type && !onClientsTab ? 1 : 0) +
        (leads ? 1 : 0) +
        (tags.length ? 1 : 0)
      }
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
        placeholder='Any leads'
        options={LEADS_OPTIONS}
      />
      <FilterSelect
        mode='multi'
        values={pickedTags}
        onChange={values => update({ tags: values.join(',') || undefined })}
        placeholder='All tags'
        options={tagFilterOptions}
      />
    </FilterBar>
  )
}
