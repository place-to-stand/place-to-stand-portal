import 'server-only'

import { cache } from 'react'

import type { AppUser } from '@/lib/auth/session'
import { assertCan } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors/http'
import type { FeedbackReportRecord } from '@/lib/feedback/types'
import {
  countFeedbackReports,
  countNewFeedbackReports,
  getFeedbackReportById,
  getProjectFeedbackSettings,
  listFeedbackReports,
  type FeedbackFilters,
} from '@/lib/queries/feedback'

type FeedbackPage = {
  items: FeedbackReportRecord[]
  /** Rows matching the filters (paging and "Showing N of M"). */
  totalCount: number
  /** The tab's rows with no filters (the page count). */
  unfilteredTotalCount: number
  totalPages: number
}

export const fetchFeedbackReports = cache(
  async (
    user: AppUser,
    {
      page,
      pageSize,
      ...filters
    }: FeedbackFilters & { page: number; pageSize: number }
  ): Promise<FeedbackPage> => {
    assertCan(user, 'feedback.manage')

    const tabFilters: FeedbackFilters = {
      archived: filters.archived,
      projectId: filters.projectId,
    }
    const [items, totalCount, unfilteredTotalCount] = await Promise.all([
      listFeedbackReports(filters, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      countFeedbackReports(filters),
      countFeedbackReports(tabFilters),
    ])

    return {
      items,
      totalCount,
      unfilteredTotalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    }
  }
)

export const fetchFeedbackReportById = cache(
  async (user: AppUser, id: string): Promise<FeedbackReportRecord> => {
    assertCan(user, 'feedback.manage')
    const report = await getFeedbackReportById(id)
    if (!report) throw new NotFoundError('Feedback report not found')
    return report
  }
)

export const fetchNewFeedbackCount = cache(
  async (user: AppUser): Promise<number> => {
    assertCan(user, 'feedback.manage')
    return countNewFeedbackReports()
  }
)

export const fetchProjectFeedbackSettings = cache(
  async (user: AppUser, projectId: string) => {
    assertCan(user, 'feedback.manage')
    const settings = await getProjectFeedbackSettings(projectId)
    if (!settings) throw new NotFoundError('Project not found')
    return settings
  }
)
