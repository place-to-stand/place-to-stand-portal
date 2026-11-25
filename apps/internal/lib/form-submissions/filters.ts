import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'

// Sort allowlist for the submissions pages. Submissions are offset
// paginated, so each field here needs only a matching ORDER BY expression in
// the query, no cursor descriptors. `received` maps to last_activity_at,
// the column the Received column renders. `source` is worked out in code
// (describeAttribution), so the query sorts it in memory.
const SUBMISSION_SORT_FIELDS = [
  'received',
  'form',
  'contact',
  'company',
  'outcome',
  'source',
  'archived',
] as const
export type SubmissionSortField = (typeof SUBMISSION_SORT_FIELDS)[number]

export const DEFAULT_SUBMISSIONS_SORT = {
  field: 'received',
  direction: 'desc',
} as const satisfies ParsedSort<SubmissionSortField>

export function isSubmissionSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (SUBMISSION_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

/**
 * Parse `?sort=` for the submissions pages. Invalid or absent values fall
 * back to the view default (received desc).
 */
export function parseSubmissionsSort(
  raw: string | undefined
): ParsedSort<SubmissionSortField> {
  return parseSortParam(raw, SUBMISSION_SORT_FIELDS, DEFAULT_SUBMISSIONS_SORT)
}

/**
 * `?contact=`. One param, two states, same convention as
 * `?unacknowledged=`: '1' = rows that identify someone, '0' = anonymous rows.
 */
export function parseContactFilter(
  raw: string | undefined
): boolean | undefined {
  return raw === '1' ? true : raw === '0' ? false : undefined
}

export function isContactFilterValue(value: string): boolean {
  return value === '1' || value === '0'
}

/** `?spam=`, same shape: '1' = spam only, '0' = everything but spam. */
export const parseSpamFilter = parseContactFilter
export const isSpamFilterValue = isContactFilterValue
