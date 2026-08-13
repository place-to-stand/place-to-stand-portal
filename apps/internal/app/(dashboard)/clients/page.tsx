import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { fetchClientsWithMetrics } from '@/lib/data/clients'
import { listClientsForSettings } from '@/lib/queries/clients'
import {
  parseClientsLandingSort,
  parseClientsSearchParams,
} from '@/lib/settings/clients/filters'

import { ClientsLanding } from './_components/clients-landing'
import { ClientsAddButton } from './_components/clients-add-button'
import { ClientsFilters } from './_components/clients-filters'
import { resolveClientDeepLink } from './_lib/client-deep-link'
import { sortLandingClients } from './_lib/sort-landing-clients'
import { CLIENTS_TABS } from './_lib/tabs'

export const metadata: Metadata = {
  title: 'Clients | Place to Stand Portal',
}

type ClientsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const user = await requireUser()
  const params = searchParams ? await searchParams : {}
  const { cursor, direction, limit, billing, search, sort } =
    parseClientsSearchParams(params)
  // `sort` above stays keyset-safe for the paginated query below; the landing
  // table sorts in memory and accepts the wider metric-backed allowlist.
  const landingSort = parseClientsLandingSort(params)

  // Share links: `?client=<id>` opens the edit sheet even when the filtered
  // landing list doesn't contain that row (redirects to the archive tab when
  // the client is archived).
  const clientParam = params.client
  const deepLink = await resolveClientDeepLink(
    user,
    Array.isArray(clientParam) ? clientParam[0] : clientParam,
    'active'
  )

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

  const sortedClients = sortLandingClients(clients, landingSort)

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
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <ClientsFilters basePath='/clients' search={search} billing={billing} />
        <ClientsLanding
          clients={sortedClients}
          deepLinkedClient={deepLink.record}
          clientNotFound={deepLink.notFound}
        />
      </section>
    </PageShell>
  )
}
