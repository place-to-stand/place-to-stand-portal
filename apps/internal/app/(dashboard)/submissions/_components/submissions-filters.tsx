'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { useListParams } from '@/hooks/use-list-params'
import {
  FORM_SUBMISSION_KIND_LABELS,
  FORM_SUBMISSION_KIND_VALUES,
  FORM_SUBMISSION_STATUS_LABELS,
  FORM_SUBMISSION_STATUS_VALUES,
  isFormSubmissionKind,
  isFormSubmissionStatus,
  type FormSubmissionKind,
  type FormSubmissionStatus,
} from '@/lib/form-submissions/constants'

const UNACKNOWLEDGED = 'unacknowledged'

const UNACKNOWLEDGED_OPTIONS = [
  { value: UNACKNOWLEDGED, label: 'Unacknowledged' },
]

const KIND_OPTIONS = FORM_SUBMISSION_KIND_VALUES.map(kind => ({
  value: kind,
  label: FORM_SUBMISSION_KIND_LABELS[kind],
}))

const STATUS_OPTIONS = FORM_SUBMISSION_STATUS_VALUES.map(status => ({
  value: status,
  label: FORM_SUBMISSION_STATUS_LABELS[status],
}))

type SubmissionsFiltersProps = {
  search?: string
  activeKind?: FormSubmissionKind
  activeStatus?: FormSubmissionStatus
  /**
   * PW1 unacknowledged quick filter — List tab only (archived rows are
   * never unacknowledged, so the archive page omits the prop entirely).
   */
  activeUnacknowledged?: boolean
  showUnacknowledgedFilter?: boolean
  /** Base path to push filter changes to — '/submissions' or '/submissions/archive'. */
  basePath: string
}

export function SubmissionsFilters({
  search,
  activeKind,
  activeStatus,
  activeUnacknowledged,
  showUnacknowledgedFilter = false,
  basePath,
}: SubmissionsFiltersProps) {
  // Filters reset to page 1 — staying on page 7 of a smaller result set
  // would render an empty table (offset pagination).
  const { update } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      q: {},
      unacknowledged: { isValid: value => value === '1' },
      kind: { isValid: value => isFormSubmissionKind(value) },
      status: { isValid: value => isFormSubmissionStatus(value) },
    },
  })

  return (
    <FilterBar>
      <SearchInput
        value={search}
        onCommit={value => update({ q: value })}
        placeholder='Search submissions…'
      />
      {showUnacknowledgedFilter ? (
        <FilterSelect
          value={activeUnacknowledged ? UNACKNOWLEDGED : undefined}
          onChange={value =>
            update({ unacknowledged: value ? '1' : undefined })
          }
          placeholder='All'
          options={UNACKNOWLEDGED_OPTIONS}
        />
      ) : null}
      <FilterSelect
        value={activeKind}
        onChange={value => update({ kind: value })}
        placeholder='All forms'
        options={KIND_OPTIONS}
      />
      <FilterSelect
        value={activeStatus}
        onChange={value => update({ status: value })}
        placeholder='All statuses'
        options={STATUS_OPTIONS}
      />
    </FilterBar>
  )
}
