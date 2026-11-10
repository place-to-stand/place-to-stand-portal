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

// Plain text: "Client" / "Not a client".
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
  tags,
  basePath,
}: {
  search?: string
  type?: CompanyTypeFilter
  leads?: CompanyLeadsFilter
  tags: string[]
  basePath: string
}) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      q: {},
      type: { isValid: isCompanyType },
      leads: { isValid: isCompanyLeads },
      tags: {},
    },
  })
  // Every company tag in use, as the list shows it; a tag in the link that
  // no company has any more still shows, so it can be cleared.
  const { data: tagOptions = [] } = useTagOptions('company')
  const tagFilterOptions = [
    ...tagOptions.filter(option => option.count > 0),
    ...tags
      .filter(name => !tagOptions.some(o => tagKey(o.name) === tagKey(name)))
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
        (type ? 1 : 0) + (leads ? 1 : 0) + (tags.length ? 1 : 0)
      }
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
