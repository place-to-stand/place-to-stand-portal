'use client'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { ResetFiltersButton } from '@/components/table-toolbar/reset-filters-button'
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
import { isContactFilterValue } from '@/lib/form-submissions/filters'

type AcknowledgementFilter = 'unacknowledged' | 'acknowledged'

const ACKNOWLEDGEMENT_OPTIONS = [
  { value: 'unacknowledged', label: 'Unacknowledged' },
  { value: 'acknowledged', label: 'Acknowledged' },
]

// The URL keeps the original `?unacknowledged=` key so existing links still
// work; '0' now selects the complement rather than meaning "unset".
const ACK_PARAM: Record<AcknowledgementFilter, string> = {
  unacknowledged: '1',
  acknowledged: '0',
}

// Same one-param-two-states shape as the acknowledgement filter.
const CONTACT_OPTIONS = [
  { value: '1', label: 'With contact only' },
  { value: '0', label: 'Anonymous only' },
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
  /** `?contact=` — true: identified rows only, false: anonymous only. */
  activeContact?: boolean
  /**
   * PW1 acknowledgement quick filter — List tab only (archived rows are
   * never unacknowledged, so the archive page omits the prop entirely).
   */
  activeAcknowledgement?: AcknowledgementFilter
  showUnacknowledgedFilter?: boolean
  /** Base path to push filter changes to — '/submissions' or '/submissions/archive'. */
  basePath: string
}

export function SubmissionsFilters({
  search,
  activeKind,
  activeStatus,
  activeContact,
  activeAcknowledgement,
  showUnacknowledgedFilter = false,
  basePath,
}: SubmissionsFiltersProps) {
  // Filters reset to page 1 — staying on page 7 of a smaller result set
  // would render an empty table (offset pagination).
  const { update, hasActiveFilters, reset } = useListParams({
    basePath,
    resetKeys: ['page'],
    filters: {
      q: {},
      unacknowledged: { isValid: value => value === '1' || value === '0' },
      kind: { isValid: value => isFormSubmissionKind(value) },
      status: { isValid: value => isFormSubmissionStatus(value) },
      contact: { isValid: isContactFilterValue },
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
          value={activeAcknowledgement}
          onChange={value =>
            update({
              unacknowledged: value
                ? ACK_PARAM[value as AcknowledgementFilter]
                : undefined,
            })
          }
          placeholder='All submissions'
          options={ACKNOWLEDGEMENT_OPTIONS}
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
      <FilterSelect
        value={
          activeContact === undefined ? undefined : activeContact ? '1' : '0'
        }
        onChange={value => update({ contact: value })}
        placeholder='All visitors'
        options={CONTACT_OPTIONS}
      />
      <ResetFiltersButton show={hasActiveFilters} onReset={reset} />
    </FilterBar>
  )
}
