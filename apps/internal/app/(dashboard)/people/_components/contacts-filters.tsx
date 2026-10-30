'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import type { ClientOption } from '@/lib/queries/contacts'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import {
  SIGN_IN_FILTER_LABELS,
  SIGN_IN_FILTER_VALUES,
  isSignInFilter,
  type SignInFilter,
} from '@/lib/settings/contacts/filters'

type ContactsFiltersProps = {
  search?: string
  /** Validated company filter value (`?companyId=<uuid>`). */
  companyId?: string
  /** Every live company, clients first, for the company filter. */
  companies: ClientOption[]
  /** Base path to push filter changes to — '/people' or '/people/archive'. */
  basePath: string
  /** Who can sign in (`?signIn=`); admins only. */
  signIn?: SignInFilter
  showSignInFilter?: boolean
}

export function ContactsFilters({
  search,
  companyId,
  companies,
  basePath,
  signIn,
  showSignInFilter = false,
}: ContactsFiltersProps) {
  // Contacts tables paginate by offset, so `page` is the pagination key
  // cleared on every filter change (not cursor/dir).
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      q: {},
      companyId: { isValid: value => UUID_PATTERN.test(value) },
      signIn: { isValid: isSignInFilter },
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
      activeFilterCount={(companyId ? 1 : 0) + (signIn ? 1 : 0)}
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
        }))}
      />
      {showSignInFilter ? (
        <FilterSelect
          value={signIn}
          onChange={value => update({ signIn: value })}
          placeholder='Any sign-in'
          options={SIGN_IN_FILTER_VALUES.map(value => ({
            value,
            label: SIGN_IN_FILTER_LABELS[value],
          }))}
        />
      ) : null}
    </FilterBar>
  )
}
