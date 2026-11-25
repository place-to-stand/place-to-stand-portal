import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { fetchFeedbackReports } from '@/lib/data/feedback'
import { parseFeedbackListParams } from '@/lib/feedback/list-params'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { readPageSize } from '@/lib/pagination/page-size.server'
import type { RawSearchParams } from '@/lib/pagination/params'
import { pageSheetParam } from '@/lib/sheets/stack'

import { resolveFeedbackDeepLink } from '../_lib/feedback-deep-link'
import { FEEDBACK_TABS } from '../_lib/tabs'
import { FeedbackFilters } from './feedback-filters'
import { FeedbackTable } from './feedback-table'

const MODES = {
  active: {
    activeTab: 'feedback',
    basePath: '/feedback',
    countLabel: 'reports',
    crumbs: [],
  },
  archive: {
    activeTab: 'archive',
    basePath: '/feedback/archive',
    countLabel: 'archived reports',
    crumbs: [{ label: 'Archive' }],
  },
} as const

/**
 * Every project's feedback in one triage list, newest first. Reports never
 * land on a board by themselves: each is read here, then turned into a task
 * or archived.
 */
export async function FeedbackListPage({
  params,
  mode,
}: {
  params: RawSearchParams
  mode: 'active' | 'archive'
}) {
  const view = MODES[mode]
  const user = await requirePage('feedback.manage')
  const pageSize = await readPageSize()
  const { page, type, state, search } = parseFeedbackListParams(params)

  const deepLink = await resolveFeedbackDeepLink(
    user,
    pageSheetParam('feedback', params),
    mode
  )

  const { items, totalCount, unfilteredTotalCount, totalPages } =
    await fetchFeedbackReports(user, {
      page,
      pageSize,
      type,
      state,
      search,
      archived: mode === 'archive',
    })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/feedback'), ...view.crumbs]}
      tabs={FEEDBACK_TABS}
      activeTab={view.activeTab}
      count={{
        label: view.countLabel,
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
    >
      <PagePanel className='space-y-4'>
        <FeedbackFilters
          search={search}
          activeType={type}
          activeState={state}
          basePath={view.basePath}
        />
        <FeedbackTable
          reports={items}
          totalCount={totalCount}
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          mode={mode}
          basePath={view.basePath}
          ownsSheet
          deepLinkedReport={deepLink.report}
          deepLinkNotFound={deepLink.notFound}
        />
      </PagePanel>
    </PageShell>
  )
}
