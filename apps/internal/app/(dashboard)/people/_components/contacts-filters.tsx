'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import type { ClientOption } from '@/lib/queries/contacts'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import {
  ROLE_FILTER_LABELS,
  ROLE_FILTER_VALUES,
  isRoleFilter,
} from '@/lib/people/filters'
import { RoleBadge } from '@/components/auth/role-badge'
import { CompanyNameWithState } from '@/components/companies/client-badge'

type ContactsFiltersProps = {
  search?: string
  /** Validated company filter value (`?companyId=<uuid>`). */
  companyId?: string
  /** The companies of the people this page lists, clients first. */
  companies: ClientOption[]
  /** The page filter changes stay on: /people, /people/users or /people/archive. */
  basePath: string
  /** The Users page's Role filter (`?role=`). */
  role?: (typeof ROLE_FILTER_VALUES)[number]
  showRoleFilter?: boolean
}

export function ContactsFilters({
  search,
  companyId,
  companies,
  basePath,
  role,
  showRoleFilter = false,
}: ContactsFiltersProps) {
  // Contacts tables paginate by offset, so `page` is the pagination key
  // cleared on every filter change (not cursor/dir).
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      q: {},
      companyId: { isValid: value => UUID_PATTERN.test(value) },
      ...(showRoleFilter ? { role: { isValid: isRoleFilter } } : {}),
    },
  })

  return (
    <FilterBar
      search={
        <SearchInput
          value={search}
          onCommit={value => update({ q: value })}
          placeholder='Search people…'
        />
      }
      activeFilterCount={(companyId ? 1 : 0) + (role ? 1 : 0)}
      showReset={hasActiveFilters}
      onReset={reset}
    >
      <FilterSelect
        value={companyId}
        onChange={value => update({ companyId: value })}
        placeholder='All companies'
        options={companies.map(company => ({
          value: company.id,
          label: company.name,
          // Billed companies carry the Client badge, as in the pickers.
          badge: company.isClient ? (
            <CompanyNameWithState name={company.name} isClient />
          ) : undefined,
        }))}
      />
      {showRoleFilter ? (
        <FilterSelect
          value={role}
          onChange={value => update({ role: value })}
          placeholder='All roles'
          options={ROLE_FILTER_VALUES.map(value => ({
            value,
            label: ROLE_FILTER_LABELS[value],
            // A role shows as the Role column's badge.
            badge: <RoleBadge role={value} />,
          }))}
        />
      ) : null}
    </FilterBar>
  )
}
