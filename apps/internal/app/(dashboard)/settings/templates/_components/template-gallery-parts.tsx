'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { ResetFiltersButton } from '@/components/table-toolbar/reset-filters-button'
import { SearchInput } from '@/components/table-toolbar/search-input'
import type { TemplateAudience } from '@/lib/templates/audience'

import {
  AUDIENCE_STYLES,
  TEMPLATE_AUDIENCES,
} from './template-labels'

const AUDIENCE_OPTIONS = TEMPLATE_AUDIENCES.map(value => ({
  value,
  label: AUDIENCE_STYLES[value].label,
  badgeClassName: AUDIENCE_STYLES[value].badgeClassName,
}))

export type TemplateFilterState = {
  query: string | undefined
  audiences: TemplateAudience[]
}

export const EMPTY_TEMPLATE_FILTERS: TemplateFilterState = {
  query: undefined,
  audiences: [],
}

/** The list pages' toolbar (search, recipients, reset) over local state. */
export function TemplateFilters({
  value,
  onChange,
}: {
  value: TemplateFilterState
  onChange: (next: TemplateFilterState) => void
}) {
  return (
    <FilterBar>
      <SearchInput
        value={value.query}
        onCommit={query => onChange({ ...value, query })}
        placeholder='Search templates…'
      />
      <FilterSelect
        mode='multi'
        values={value.audiences}
        onChange={audiences =>
          onChange({ ...value, audiences: audiences as TemplateAudience[] })
        }
        placeholder='Recipients'
        options={AUDIENCE_OPTIONS}
      />
      <ResetFiltersButton
        show={Boolean(value.query) || value.audiences.length > 0}
        onReset={() => onChange(EMPTY_TEMPLATE_FILTERS)}
      />
    </FilterBar>
  )
}

/**
 * True when a template passes the filters. `texts` is what search looks in;
 * an empty recipient list means no filter, as in the other multi filters.
 */
export function matchesTemplateFilters(
  filters: TemplateFilterState,
  audiences: TemplateAudience[],
  texts: string[]
) {
  const needle = (filters.query ?? '').trim().toLowerCase()
  return (
    (filters.audiences.length === 0 ||
      audiences.some(audience => filters.audiences.includes(audience))) &&
    (needle === '' || texts.some(text => text.toLowerCase().includes(needle)))
  )
}

/** A titled row of cards that wraps to as many lines as it needs. */
export function TemplateSection({
  id,
  label,
  count,
  children,
}: {
  id: string
  label: string
  count: number
  children: React.ReactNode
}) {
  const headingId = `template-group-${id}`
  return (
    <section aria-labelledby={headingId} className='flex flex-col gap-3'>
      <h2 id={headingId} className='flex items-baseline gap-2'>
        <span className='text-base font-semibold'>{label}</span>
        <span className='text-muted-foreground text-xs tabular-nums'>
          {count}
        </span>
      </h2>
      <ul className='grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3'>
        {children}
      </ul>
    </section>
  )
}

export function NoMatchingTemplates() {
  return (
    <p className='text-muted-foreground text-sm'>
      No templates match. Try a different search or recipient.
    </p>
  )
}
