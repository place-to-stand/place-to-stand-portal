'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FORM_SUBMISSION_KIND_LABELS,
  FORM_SUBMISSION_KIND_VALUES,
  FORM_SUBMISSION_STATUS_LABELS,
  FORM_SUBMISSION_STATUS_VALUES,
  type FormSubmissionKind,
  type FormSubmissionStatus,
} from '@/lib/form-submissions/constants'

const ALL = 'all'
const UNACKNOWLEDGED = 'unacknowledged'

type SubmissionsFiltersProps = {
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
  activeKind,
  activeStatus,
  activeUnacknowledged,
  showUnacknowledgedFilter = false,
  basePath,
}: SubmissionsFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
      }

      router.push(`${basePath}?${next.toString()}`)
    },
    [basePath, router, searchParams]
  )

  return (
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
      {showUnacknowledgedFilter ? (
        <Select
          value={activeUnacknowledged ? UNACKNOWLEDGED : ALL}
          onValueChange={value =>
            updateParams({
              unacknowledged: value === UNACKNOWLEDGED ? '1' : undefined,
              page: undefined,
            })
          }
        >
          <SelectTrigger className='w-[170px]'>
            <SelectValue placeholder='All' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            <SelectItem value={UNACKNOWLEDGED}>Unacknowledged</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      <Select
        value={activeKind ?? ALL}
        onValueChange={value =>
          // Filters reset to page 1 - staying on page 7 of a smaller
          // result set would render an empty table.
          updateParams({
            kind: value === ALL ? undefined : value,
            page: undefined,
          })
        }
      >
        <SelectTrigger className='w-[160px]'>
          <SelectValue placeholder='All forms' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All forms</SelectItem>
          {FORM_SUBMISSION_KIND_VALUES.map(kind => (
            <SelectItem key={kind} value={kind}>
              {FORM_SUBMISSION_KIND_LABELS[kind]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={activeStatus ?? ALL}
        onValueChange={value =>
          updateParams({
            status: value === ALL ? undefined : value,
            page: undefined,
          })
        }
      >
        <SelectTrigger className='w-[180px]'>
          <SelectValue placeholder='All statuses' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {FORM_SUBMISSION_STATUS_VALUES.map(status => (
            <SelectItem key={status} value={status}>
              {FORM_SUBMISSION_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
