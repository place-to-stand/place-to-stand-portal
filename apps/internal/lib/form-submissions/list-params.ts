import {
  isFormSubmissionKind,
  isFormSubmissionStatus,
} from '@/lib/form-submissions/constants'
import {
  parseContactFilter,
  parseSubmissionsSort,
} from '@/lib/form-submissions/filters'
import { firstParam, type RawSearchParams } from '@/lib/pagination/params'

/**
 * The submissions list's filters, read from its URL. Shared by the list
 * page and bulk actions on "every matching submission", so both see the
 * same rows.
 */
export function parseSubmissionsListParams(
  params: RawSearchParams,
  mode: 'active' | 'archive'
) {
  const kindParam = firstParam(params.kind)
  const statusParam = firstParam(params.status)
  // One param, two states: '1' = needs attention, '0' = already cleared.
  // The archive has no acknowledgement filter.
  const ackParam =
    mode === 'active' ? firstParam(params.unacknowledged) : undefined

  return {
    page: Math.max(1, Number.parseInt(firstParam(params.page) ?? '1', 10) || 1),
    kind: isFormSubmissionKind(kindParam) ? kindParam : undefined,
    status: isFormSubmissionStatus(statusParam) ? statusParam : undefined,
    unacknowledgedOnly: ackParam === '1',
    acknowledgedOnly: ackParam === '0',
    search: firstParam(params.q)?.trim() || undefined,
    hasContact: parseContactFilter(firstParam(params.contact)),
    sort: parseSubmissionsSort(firstParam(params.sort)),
  }
}
