import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { fetchFormSubmissions } from '@/lib/data/form-submissions'
import {
  isFormSubmissionKind,
  isFormSubmissionStatus,
} from '@/lib/form-submissions/constants'
import { parseSubmissionsSort } from '@/lib/form-submissions/filters'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { SubmissionsFilters } from './_components/submissions-filters'
import { SubmissionsTable } from './_components/submissions-table'
import { resolveSubmissionDeepLink } from './_lib/submission-deep-link'
import { SUBMISSIONS_TABS } from './_lib/tabs'

export const metadata: Metadata = {
  title: 'Submissions',
}

const PAGE_SIZE = 25

type SubmissionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function SubmissionsContent({ searchParams }: SubmissionsPageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}

  const currentPage = Math.max(
    1,
    Number.parseInt(firstParam(params.page) ?? '1', 10) || 1
  )

  const kindParam = firstParam(params.kind)
  const statusParam = firstParam(params.status)
  const kind = isFormSubmissionKind(kindParam) ? kindParam : undefined
  const status = isFormSubmissionStatus(statusParam) ? statusParam : undefined
  // One param, two states: '1' = needs attention, '0' = already cleared.
  const ackParam = firstParam(params.unacknowledged)
  const unacknowledgedOnly = ackParam === '1'
  const acknowledgedOnly = ackParam === '0'
  const search = firstParam(params.q)?.trim() || undefined
  const sort = parseSubmissionsSort(firstParam(params.sort))

  // Share links: ?submission=<id> opens the detail sheet directly (redirects
  // to the archive tab when the row is archived).
  const deepLink = await resolveSubmissionDeepLink(
    currentUser,
    firstParam(params.submission),
    'active'
  )

  const { items, totalCount, unfilteredTotalCount, totalPages } =
    await fetchFormSubmissions(currentUser, {
      page: currentPage,
      pageSize: PAGE_SIZE,
      kind,
      status,
      unacknowledgedOnly,
      acknowledgedOnly,
      search,
      sort,
    })

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/submissions')}
      tabs={SUBMISSIONS_TABS}
      activeTab='submissions'
      count={{
        label: 'submissions',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm space-y-4'>
        <SubmissionsFilters
          search={search}
          activeKind={kind}
          activeStatus={status}
          activeAcknowledgement={
            unacknowledgedOnly ? 'unacknowledged' : acknowledgedOnly ? 'acknowledged' : undefined
          }
          showUnacknowledgedFilter
          basePath='/submissions'
        />
        <SubmissionsTable
          submissions={items}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          mode='active'
          basePath='/submissions'
          deepLinkedSubmission={deepLink.submission}
          deepLinkNotFound={deepLink.notFound}
        />
      </section>
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs) so only the table area pulses
// while data streams in — the count chip appears with it.
function SubmissionsPageFallback() {
  return (
    <PageShell
      breadcrumbs={crumbsForNav('/submissions')}
      tabs={SUBMISSIONS_TABS}
      activeTab='submissions'
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function SubmissionsPage({
  searchParams,
}: SubmissionsPageProps) {
  return (
    <Suspense fallback={<SubmissionsPageFallback />}>
      <SubmissionsContent searchParams={searchParams} />
    </Suspense>
  )
}
