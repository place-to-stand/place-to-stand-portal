import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { fetchFormSubmissions } from '@/lib/data/form-submissions'
import { parseSubmissionsListParams } from '@/lib/form-submissions/list-params'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { SubmissionsFilters } from './submissions-filters'
import { SubmissionsTable } from './submissions-table'
import { resolveSubmissionDeepLink } from '../_lib/submission-deep-link'
import { SUBMISSIONS_TABS } from '../_lib/tabs'
import { PagePanel } from '@/components/layout/page-panel'

import type { RawSearchParams } from '@/lib/pagination/params'
import { pageSheetParam } from '@/lib/sheets/stack'

export type ListMode = 'active' | 'archive'

const MODES = {
  active: {
    tab: 'active',
    activeTab: 'submissions',
    basePath: '/submissions',
    countLabel: 'submissions',
    crumbs: [],
  },
  archive: {
    tab: 'archive',
    activeTab: 'archive',
    basePath: '/submissions/archive',
    countLabel: 'archived submissions',
    crumbs: [{ label: 'Archive' }],
  },
} as const

/** The submission list, active or archived: both tabs render this. */
export async function SubmissionsListPage({
  params,
  mode,
}: {
  params: RawSearchParams
  mode: ListMode
}) {
  const view = MODES[mode]
  const currentUser = await requirePage('submissions.manage')
  const pageSize = await readPageSize()

  const {
    page: currentPage,
    kind,
    status,
    unacknowledgedOnly,
    acknowledgedOnly,
    search,
    hasContact,
    sort,
  } = parseSubmissionsListParams(params, mode)

  // Share links: ?submission=<id> opens the detail sheet directly (redirects
  // to the other tab when the row was archived or restored).
  const deepLink = await resolveSubmissionDeepLink(
    currentUser,
    pageSheetParam('submission', params),
    view.tab
  )

  const { items, totalCount, unfilteredTotalCount, totalPages } =
    await fetchFormSubmissions(currentUser, {
      page: currentPage,
      pageSize: pageSize,
      kind,
      status,
      unacknowledgedOnly,
      acknowledgedOnly,
      archived: mode === 'archive',
      search,
      hasContact,
      sort,
    })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/submissions'), ...view.crumbs]}
      tabs={SUBMISSIONS_TABS}
      activeTab={view.activeTab}
      count={{
        label: view.countLabel,
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
    >
      <PagePanel className='space-y-4'>
        <SubmissionsFilters
          search={search}
          activeKind={kind}
          activeStatus={status}
          activeContact={hasContact}
          activeAcknowledgement={
            unacknowledgedOnly
              ? 'unacknowledged'
              : acknowledgedOnly
                ? 'acknowledged'
                : undefined
          }
          showUnacknowledgedFilter={mode === 'active'}
          basePath={view.basePath}
        />
        <SubmissionsTable
          submissions={items}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          mode={mode}
          basePath={view.basePath}
          deepLinkedSubmission={deepLink.submission}
          deepLinkNotFound={deepLink.notFound}
        />
      </PagePanel>
    </PageShell>
  )
}
