import 'server-only'

import { cache } from 'react'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors/http'
import {
  countFormSubmissions,
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
import type { FormSubmission } from '@pts/db/types'

export type FormSubmissionsPage = {
  items: FormSubmissionRecord[]
  totalCount: number
  totalPages: number
}

type FetchOptions = {
  page: number
  pageSize: number
  kind?: FormSubmissionKindValue
  status?: FormSubmissionStatusValue
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
    { page, pageSize, kind, status }: FetchOptions
  ): Promise<FormSubmissionsPage> => {
    // Submissions are admin-only - enforce at data layer for defense in depth
    assertAdmin(user)

    const [rows, totalCount] = await Promise.all([
      listFormSubmissions({
        offset: (page - 1) * pageSize,
        limit: pageSize,
        kind,
        status,
      }),
      countFormSubmissions({ kind, status }),
    ])

    return {
      items: rows.map(toRecord),
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    }
  }
)

export const fetchFormSubmissionById = cache(
  async (user: AppUser, id: string): Promise<FormSubmissionRecord> => {
    assertAdmin(user)

    const row = await getFormSubmissionById(id)

    if (!row) {
      throw new NotFoundError('Submission not found')
    }

    return toRecord(row)
  }
)
