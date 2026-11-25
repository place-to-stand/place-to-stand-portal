'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import {
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPES,
  isFeedbackType,
  type FeedbackType,
} from '@/lib/feedback/constants'
import { isFeedbackState } from '@/lib/feedback/list-params'
import { FEEDBACK_TYPE_TOKENS } from '@/lib/feedback/tokens'
import type { FeedbackState } from '@/lib/feedback/types'

const TYPE_OPTIONS = FEEDBACK_TYPES.map(type => ({
  value: type,
  label: FEEDBACK_TYPE_LABELS[type],
  badgeClassName: FEEDBACK_TYPE_TOKENS[type],
}))

const STATE_OPTIONS: { value: FeedbackState; label: string }[] = [
  { value: 'new', label: 'New only' },
  { value: 'task', label: 'Turned into tasks' },
  { value: 'not_spam', label: 'Hide spam' },
  { value: 'spam', label: 'Spam only' },
]

export function FeedbackFilters({
  search,
  activeType,
  activeState,
  basePath,
}: {
  search?: string
  activeType?: FeedbackType
  activeState?: FeedbackState
  /** Where filter changes go: the list, its archive or a project's tab. */
  basePath: string
}) {
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      q: {},
      type: { isValid: value => isFeedbackType(value) },
      state: { isValid: value => isFeedbackState(value) },
    },
  })

  return (
    <FilterBar
      search={
        <SearchInput
          value={search}
          onCommit={value => update({ q: value })}
          placeholder='Search feedback…'
        />
      }
      activeFilterCount={
        [activeType, activeState].filter(value => value !== undefined).length
      }
      showReset={hasActiveFilters}
      onReset={reset}
    >
      <FilterSelect
        value={activeState}
        onChange={value => update({ state: value })}
        placeholder='All reports'
        options={STATE_OPTIONS}
      />
      <FilterSelect
        value={activeType}
        onChange={value => update({ type: value })}
        placeholder='All types'
        options={TYPE_OPTIONS}
      />
    </FilterBar>
  )
}
