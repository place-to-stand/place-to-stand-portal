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
  /** Validated linked-client filter value (`?clientId=<uuid>`). */
  clientId?: string
  /** Active clients for the linked-client filter options. */
  clients: ClientOption[]
  /** Base path to push filter changes to — '/contacts' or '/contacts/archive'. */
  basePath: string
  /** Who can sign in (`?signIn=`); admins only. */
  signIn?: SignInFilter
  showSignInFilter?: boolean
}

export function ContactsFilters({
  search,
  clientId,
  clients,
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
      clientId: { isValid: value => UUID_PATTERN.test(value) },
      signIn: { isValid: isSignInFilter },
    },
  })

  return (
    <FilterBar
      search={
        <SearchInput
          value={search}
          onCommit={value => update({ q: value })}
          placeholder='Search contacts…'
        />
      }
      activeFilterCount={(clientId ? 1 : 0) + (signIn ? 1 : 0)}
      showReset={hasActiveFilters}
      onReset={reset}
    >
      <FilterSelect
        value={clientId}
        onChange={value => update({ clientId: value })}
        placeholder='All clients'
        options={clients.map(client => ({
          value: client.id,
          label: client.name,
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
