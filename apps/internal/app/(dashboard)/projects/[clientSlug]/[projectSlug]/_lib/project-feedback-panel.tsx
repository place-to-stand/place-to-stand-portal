import 'server-only'

import { PagePanel } from '@/components/layout/page-panel'
import type { AppUser } from '@/lib/auth/session'
import {
  fetchFeedbackReports,
  fetchProjectFeedbackSettings,
} from '@/lib/data/feedback'
import { parseFeedbackListParams } from '@/lib/feedback/list-params'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { FeedbackFilters } from '../../../../feedback/_components/feedback-filters'
import { FeedbackTable } from '../../../../feedback/_components/feedback-table'
import { ProjectFeedbackSettings } from './project-feedback-settings'

/**
 * A project's Feedback tab: the widget's settings, then this project's
 * reports (the Feedback list held to the project). Reports open their sheet
 * over the tab.
 */
export async function ProjectFeedbackPanel({
  user,
  projectId,
  basePath,
  searchParams,
}: {
  user: AppUser
  projectId: string
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  const { page, type, state, search } = parseFeedbackListParams(searchParams)
  const pageSize = await readPageSize()
  const [settings, reports] = await Promise.all([
    fetchProjectFeedbackSettings(user, projectId),
    fetchFeedbackReports(user, {
      projectId,
      page,
      pageSize,
      type,
      state,
      search,
    }),
  ])

  return (
    <PagePanel className='space-y-8'>
      <ProjectFeedbackSettings
        projectId={projectId}
        enabled={settings.enabled}
        origins={settings.origins}
        productionDomains={settings.productionDomains}
      />
      <div className='space-y-4'>
        <FeedbackFilters
          search={search}
          activeType={type}
          activeState={state}
          basePath={basePath}
        />
        <FeedbackTable
          reports={reports.items}
          totalCount={reports.totalCount}
          currentPage={page}
          totalPages={reports.totalPages}
          pageSize={pageSize}
          mode='active'
          basePath={basePath}
          showProject={false}
        />
      </div>
    </PagePanel>
  )
}
