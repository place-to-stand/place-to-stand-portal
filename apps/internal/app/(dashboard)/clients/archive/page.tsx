import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'
import { listClientsForSettings } from '@/lib/queries/clients'
import { parseClientsSearchParams } from '@/lib/settings/clients/filters'

import { CLIENTS_TABS } from '../_lib/tabs'
import { ClientsAddButton } from '../_components/clients-add-button'
import { ClientsFilters } from '../_components/clients-filters'
import { ClientsManagementTable } from '../_components/clients-management-table'
import { resolveClientDeepLink } from '../_lib/client-deep-link'
import { mapClientToTableRow } from '../_lib/map-client-to-table-row'

type ClientsArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: 'Client Archive | Place to Stand Portal',
}

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function ClientsArchiveContent({
  searchParams,
}: ClientsArchivePageProps) {
  const admin = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const { cursor, direction, limit, billing, search, sort } =
    parseClientsSearchParams(params)

  // Share links: `?client=<id>` opens the edit sheet even when the row sits
  // on another page (redirects to the active tab when it isn't archived).
  const clientParam = params.client
  const deepLink = await resolveClientDeepLink(
    admin,
    Array.isArray(clientParam) ? clientParam[0] : clientParam,
    'archive'
  )

  const { items, totalCount, unfilteredTotalCount, pageInfo } =
    await listClientsForSettings(admin, {
      status: 'archived',
      billing,
      search,
      cursor,
      direction,
      limit,
      sort,
    })

  const clientsForTable = items.map(mapClientToTableRow)

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/clients'), { label: 'Archive' }]}
      tabs={CLIENTS_TABS}
      activeTab='archive'
      count={{
        label: 'archived clients',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<ClientsAddButton />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm space-y-4'>
        <ClientsFilters
          basePath='/clients/archive'
          search={search}
          billing={billing}
        />
        <ClientsManagementTable
          clients={clientsForTable}
          pageInfo={pageInfo}
          mode='archive'
          basePath='/clients/archive'
          deepLinkedClient={deepLink.record}
          clientNotFound={deepLink.notFound}
        />
      </section>
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs · add button) so only the
// table area pulses while data streams in — the count chip appears with it.
function ClientsArchivePageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/clients'), { label: 'Archive' }]}
      tabs={CLIENTS_TABS}
      activeTab='archive'
      primaryAction={<ClientsAddButton />}
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function ClientsArchivePage({
  searchParams,
}: ClientsArchivePageProps) {
  return (
    <Suspense fallback={<ClientsArchivePageFallback />}>
      <ClientsArchiveContent searchParams={searchParams} />
    </Suspense>
  )
}
