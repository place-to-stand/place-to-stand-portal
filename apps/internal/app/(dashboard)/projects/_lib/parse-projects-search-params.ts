import {
  PROJECT_STATUS_ENUM_VALUES,
  type ProjectStatusValue,
} from '@/lib/constants'
import type { CursorDirection } from '@/lib/pagination/cursor'
import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'
import {
  DEFAULT_PROJECTS_SORT,
  PROJECT_SORT_FIELDS,
  type ProjectSortField,
} from '@/lib/queries/projects/sort'

type RawParams = Record<string, string | string[] | undefined>

type ParsedProjectsSearchParams = {
  searchQuery: string | null
  cursor: string | null
  sort: ParsedSort<ProjectSortField>
  direction: CursorDirection
  limit: number | undefined
}

/**
 * Implicit landing status filter (PRD 004 §03, R2): a clean `/projects` URL
 * shows onboarding + active projects without counting as "filtered".
 */
export const DEFAULT_STATUS_FILTER: ProjectStatusValue[] = [
  'ONBOARDING',
  'ACTIVE',
]

/** Serialized default — the `defaultValue` comparison target for useListParams. */
export const DEFAULT_STATUS_FILTER_PARAM = DEFAULT_STATUS_FILTER.join(',')

/** Sentinel for an explicitly cleared status selection (`?status=none`). */
export const STATUS_FILTER_NONE = 'none'

export function isProjectStatusValue(
  value: string
): value is ProjectStatusValue {
  return (PROJECT_STATUS_ENUM_VALUES as readonly string[]).includes(value)
}

export type ParsedProjectsLandingSearchParams = {
  /** Selected statuses; empty array = explicitly cleared (`?status=none`). */
  statuses: ProjectStatusValue[]
  search: string | null
  /**
   * True when the URL deviates from the clean landing (non-default status
   * selection or a search query). The implicit default is NOT active (R2).
   */
  filtersActive: boolean
}

/**
 * URL semantics (preserved from the original client-side filter):
 * no param = DEFAULT_STATUS_FILTER; `?status=none` = explicitly cleared;
 * otherwise comma-joined list (invalid entries dropped, all-invalid falls
 * back to the default).
 */
export function parseProjectsLandingSearchParams(
  params: RawParams
): ParsedProjectsLandingSearchParams {
  const statusParam = extractParam(params.status)
  const searchRaw = extractParam(params.q)
  const search = searchRaw && searchRaw.trim() ? searchRaw.trim() : null

  let statuses: ProjectStatusValue[]
  if (!statusParam) {
    statuses = DEFAULT_STATUS_FILTER
  } else if (statusParam === STATUS_FILTER_NONE) {
    statuses = []
  } else {
    const parsed = statusParam.split(',').filter(isProjectStatusValue)
    statuses = parsed.length > 0 ? parsed : DEFAULT_STATUS_FILTER
  }

  const statusIsDefault =
    statuses.length === DEFAULT_STATUS_FILTER.length &&
    DEFAULT_STATUS_FILTER.every(status => statuses.includes(status))

  return {
    statuses,
    search,
    filtersActive: search !== null || (statusParam !== null && !statusIsDefault),
  }
}

export function parseProjectsSearchParams(
  params: RawParams,
): ParsedProjectsSearchParams {
  const searchQuery = extractParam(params.q)
  const cursor = extractParam(params.cursor)
  const sort = parseSortParam(
    extractParam(params.sort) ?? undefined,
    PROJECT_SORT_FIELDS,
    DEFAULT_PROJECTS_SORT
  )
  const directionParam = extractParam(params.dir)
  const direction: CursorDirection =
    directionParam === 'backward' ? 'backward' : 'forward'
  const limitRaw = extractParam(params.limit)
  const limit = Number.parseInt(limitRaw ?? '', 10)

  return {
    searchQuery,
    cursor,
    sort,
    direction,
    limit: Number.isFinite(limit) ? limit : undefined,
  }
}

function extractParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return null
}
