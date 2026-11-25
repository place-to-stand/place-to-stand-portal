import 'server-only'

import { cache } from 'react'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors/http'
import {
  countFormSubmissions,
  countUnacknowledgedFormSubmissions,
  getFormSubmissionById,
  listFormSubmissions,
} from '@/lib/queries/form-submissions'
import {
  extractAuditResponses,
  extractAuditResult,
  type FormSubmissionKindValue,
  type FormSubmissionRecord,
  type FormSubmissionStatusValue,
} from '@/lib/form-submissions/types'
import type { SubmissionSortField } from '@/lib/form-submissions/filters'
import type { ParsedSort } from '@/lib/pagination/sort'
import type { FormSubmission } from '@pts/db/types'

type FormSubmissionsPage = {
  items: FormSubmissionRecord[]
  /** Rows matching the active filters (drives paging + `Showing N of M`). */
  totalCount: number
  /** Tab-scoped total ignoring filters (the PageShell count denominator). */
  unfilteredTotalCount: number
  totalPages: number
}

type FetchOptions = {
  page: number
  pageSize: number
  kind?: FormSubmissionKindValue
  status?: FormSubmissionStatusValue
  /** Rows that warrant attention and are not yet acknowledged. */
  unacknowledgedOnly?: boolean
  /** Complement of the quick filter: rows already acknowledged. */
  acknowledgedOnly?: boolean
  /** true: archived rows (Archive tab). Default: active rows. */
  archived?: boolean
  /** Fuzzy identity search: name, email, company. */
  search?: string
  /** `?contact=`: true for identified rows, false for anonymous ones. */
  hasContact?: boolean
  /** `?spam=`: true for spam only, false for everything but spam. */
  spam?: boolean
  /** Validated `?sort=`; defaults to received desc. */
  sort?: ParsedSort<SubmissionSortField>
}

function toRecord(row: FormSubmission): FormSubmissionRecord {
  return {
    ...row,
    responses: extractAuditResponses(row.responses),
    result: extractAuditResult(row.result),
  }
}

export const fetchFormSubmissions = cache(
  async (
    user: AppUser,
    {
      page,
      pageSize,
      kind,
      status,
      unacknowledgedOnly,
      acknowledgedOnly,
      archived,
      search,
      hasContact,
      spam,
      sort,
    }: FetchOptions
  ): Promise<FormSubmissionsPage> => {
    // Submissions are admin-only - enforce at data layer for defense in depth
    assertAdmin(user)

    const [rows, totalCount, unfilteredTotalCount] = await Promise.all([
      listFormSubmissions({
        offset: (page - 1) * pageSize,
        limit: pageSize,
        kind,
        status,
        unacknowledgedOnly,
        acknowledgedOnly,
        archived,
        search,
        hasContact,
        spam,
        sort,
      }),
      countFormSubmissions({
        kind,
        status,
        unacknowledgedOnly,
        acknowledgedOnly,
        archived,
        search,
        hasContact,
        spam,
      }),
      // Tab-scoped only: same active/archive slice, filters stripped.
      countFormSubmissions({ archived }),
    ])

    return {
      items: rows.map(toRecord),
      totalCount,
      unfilteredTotalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    }
  }
)

export const fetchUnacknowledgedSubmissionCount = cache(
  async (user: AppUser): Promise<number> => {
    assertAdmin(user)

    return countUnacknowledgedFormSubmissions()
  }
)

export const fetchFormSubmissionById = cache(
  async (
    user: AppUser,
    id: string,
    includeArchived = false
  ): Promise<FormSubmissionRecord> => {
    assertAdmin(user)

    const row = await getFormSubmissionById(id, { includeArchived })

    if (!row) {
      throw new NotFoundError('Submission not found')
    }

    return toRecord(row)
  }
)
