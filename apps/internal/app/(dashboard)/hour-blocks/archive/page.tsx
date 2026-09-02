import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import {
  getHourBlockWithClientById,
  listHourBlockInvoiceDirectory,
  listHourBlocksForSettings,
} from '@/lib/queries/hour-blocks'
import { resolveSheetDeepLink } from '@/lib/sheets/resolve-deep-link'
import { hourBlockHref } from '@/lib/sheets/hrefs'
import { parseHourBlocksSearchParams } from '@/lib/settings/hour-blocks/filters'

import { HourBlocksAddButton } from '../_components/hour-blocks-add-button'
import { HourBlocksFilters } from '../_components/hour-blocks-filters'
import { HourBlocksManagementTable } from '../_components/hour-blocks-management-table'
import { HOUR_BLOCKS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Hour Blocks Archive | Settings',
}

const PAGE_SIZE = 20

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

type HourBlocksArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function HourBlocksArchiveContent({
  searchParams,
}: HourBlocksArchivePageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}

  const { page: currentPage, search, sort } = parseHourBlocksSearchParams(params)
  const offset = (currentPage - 1) * PAGE_SIZE

  const [
    { items, clients, totalCount, unfilteredTotalCount },
    invoiceDirectory,
  ] = await Promise.all([
    listHourBlocksForSettings(currentUser, {
      status: 'archived',
      offset,
      limit: PAGE_SIZE,
      search,
      sort,
    }),
    listHourBlockInvoiceDirectory(currentUser),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Resolve `?hour-block=` by id; a link to a restored block redirects back
  // to the active tab so shared links survive restore.
  const { record: deepLinkedHourBlock, notFound: hourBlockNotFound } =
    await resolveSheetDeepLink({
      idParam: firstParam(params['hour-block']),
      fetchById: id => getHourBlockWithClientById(currentUser, id),
      tab: 'archive',
      isArchived: block => block.deleted_at !== null,
      archiveHref: id => `/hour-blocks/archive?hour-block=${id}`,
      activeHref: hourBlockHref,
    })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/hour-blocks'), { label: 'Archive' }]}
      tabs={HOUR_BLOCKS_TABS}
      activeTab='archive'
      count={{
        label: 'archived hour blocks',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<HourBlocksAddButton clients={clients} />}
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <HourBlocksFilters basePath='/hour-blocks/archive' search={search} />
        <HourBlocksManagementTable
          hourBlocks={items}
          clients={clients}
          invoices={invoiceDirectory}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          mode='archive'
          basePath='/hour-blocks/archive'
          deepLinkedHourBlock={deepLinkedHourBlock}
          hourBlockNotFound={hourBlockNotFound}
        />
      </section>
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs) so only the table area pulses
// while data streams in. The add button needs the fetched client list, so it
// appears with the content.
function HourBlocksArchivePageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/hour-blocks'), { label: 'Archive' }]}
      tabs={HOUR_BLOCKS_TABS}
      activeTab='archive'
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function HourBlocksArchivePage({
  searchParams,
}: HourBlocksArchivePageProps) {
  return (
    <Suspense fallback={<HourBlocksArchivePageFallback />}>
      <HourBlocksArchiveContent searchParams={searchParams} />
    </Suspense>
  )
}
