import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { fetchFormSubmissions } from '@/lib/data/form-submissions'
import {
  isFormSubmissionKind,
  isFormSubmissionStatus,
} from '@/lib/form-submissions/constants'

import { SubmissionsFilters } from './_components/submissions-filters'
import { SubmissionsTable } from './_components/submissions-table'
import { SubmissionsTabsNav } from './_components/submissions-tabs-nav'
import { resolveSubmissionDeepLink } from './_lib/submission-deep-link'

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

export default async function SubmissionsPage({
  searchParams,
}: SubmissionsPageProps) {
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
  const unacknowledgedOnly = firstParam(params.unacknowledged) === '1'

  // Share links: ?submission=<id> opens the detail sheet directly (redirects
  // to the archive tab when the row is archived).
  const deepLink = await resolveSubmissionDeepLink(
    currentUser,
    firstParam(params.submission),
    'active'
  )

  const { items, totalCount, totalPages } = await fetchFormSubmissions(
    currentUser,
    {
      page: currentPage,
      pageSize: PAGE_SIZE,
      kind,
      status,
      unacknowledgedOnly,
    }
  )

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Submissions</h1>
          <p className='text-muted-foreground text-sm'>
            Every form submission from the marketing site, including partial and
            abandoned audits.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <SubmissionsTabsNav
            activeTab='submissions'
            className='flex-1 sm:flex-none'
          />
          <span className='text-muted-foreground text-sm whitespace-nowrap'>
            Total submissions: {totalCount}
          </span>
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm space-y-4'>
          <SubmissionsFilters
            activeKind={kind}
            activeStatus={status}
            activeUnacknowledged={unacknowledgedOnly}
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
      </div>
    </>
  )
}
