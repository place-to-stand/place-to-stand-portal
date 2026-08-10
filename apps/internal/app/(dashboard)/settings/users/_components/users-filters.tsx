'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { ResetFiltersButton } from '@/components/table-toolbar/reset-filters-button'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import {
  isUserAccess,
  isUserRole,
  USER_ACCESS_LABELS,
  USER_ACCESS_VALUES,
  USER_ROLE_LABELS,
  USER_ROLE_VALUES,
  type UserAccessFilter,
} from '@/lib/settings/users/filters'
import type { UserRoleValue } from '@/lib/types'

const ROLE_OPTIONS = USER_ROLE_VALUES.map(value => ({
  value,
  label: USER_ROLE_LABELS[value],
}))

const ACCESS_OPTIONS = USER_ACCESS_VALUES.map(value => ({
  value,
  label: USER_ACCESS_LABELS[value],
}))

type UsersFiltersProps = {
  role?: UserRoleValue
  /** Access filter value — active tab only (archived rows render `—`). */
  access?: UserAccessFilter
  search?: string
  showAccessFilter: boolean
  /** Base path to push filter changes to — '/settings/users' or '/settings/users/archive'. */
  basePath: string
}

export function UsersFilters({
  role,
  access,
  search,
  showAccessFilter,
  basePath,
}: UsersFiltersProps) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      role: { isValid: value => isUserRole(value) },
      access: { isValid: value => isUserAccess(value) },
      q: {},
    },
  })

  return (
    <FilterBar>
      <SearchInput
        value={search}
        onCommit={value => update({ q: value })}
        placeholder='Search users…'
      />
      <FilterSelect
        value={role}
        onChange={value => update({ role: value })}
        placeholder='All users'
        options={ROLE_OPTIONS}
      />
      {showAccessFilter ? (
        <FilterSelect
          value={access}
          onChange={value => update({ access: value })}
          placeholder='All access'
          options={ACCESS_OPTIONS}
        />
      ) : null}
      <ResetFiltersButton show={hasActiveFilters} onReset={reset} />
    </FilterBar>
  )
}
