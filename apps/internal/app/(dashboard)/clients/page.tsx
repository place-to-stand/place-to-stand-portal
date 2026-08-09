import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { fetchClientsWithMetrics, type ClientWithMetrics } from '@/lib/data/clients'
import { listClientsForSettings } from '@/lib/queries/clients'
import { parseClientsSearchParams } from '@/lib/settings/clients/filters'
import type { ParsedSort } from '@/lib/pagination/sort'
import type { ClientSortField } from '@/lib/settings/clients/filters'

import { ClientsLanding } from './_components/clients-landing'
import { ClientsAddButton } from './_components/clients-add-button'
import { ClientsFilters } from './_components/clients-filters'
import { CLIENTS_TABS } from './_lib/tabs'

export const metadata: Metadata = {
  title: 'Clients | Place to Stand Portal',
}

type ClientsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/**
 * The landing table is unpaginated (fetchClientsWithMetrics), so sorting is
 * a plain in-memory sort of the fetched array (PRD 004 §03 — no keyset
 * cursor concerns on this view).
 */
function sortLandingClients(
  clients: ClientWithMetrics[],
  sort: ParsedSort<ClientSortField>
): ClientWithMetrics[] {
  const factor = sort.direction === 'asc' ? 1 : -1
  return [...clients].sort((a, b) => {
    if (sort.field === 'created') {
      return a.createdAt.localeCompare(b.createdAt) * factor
    }
    return a.name.localeCompare(b.name) * factor
  })
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const user = await requireUser()
  const params = searchParams ? await searchParams : {}
  const { cursor, direction, limit, billing, search, sort } =
    parseClientsSearchParams(params)

  const [clients, managementData] = await Promise.all([
    fetchClientsWithMetrics(user, search, billing),
    listClientsForSettings(user, {
      status: 'active',
      billing,
      search,
      cursor,
      direction,
      limit,
      sort,
    }),
  ])

  const sortedClients = sortLandingClients(clients, sort)

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/clients')}
      tabs={CLIENTS_TABS}
      activeTab='clients'
      count={{
        label: 'clients',
        total: managementData.unfilteredTotalCount,
        filteredTotal: managementData.totalCount,
      }}
      primaryAction={<ClientsAddButton />}
    >
      <section className='bg-background space-y-4 rounded-xl border p-6 shadow-sm'>
        <ClientsFilters basePath='/clients' search={search} billing={billing} />
        <ClientsLanding clients={sortedClients} />
      </section>
    </PageShell>
  )
}
