import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { fetchClientsWithMetrics } from '@/lib/data/clients'
import { listClientsForSettings } from '@/lib/queries/clients'

import { ClientsLanding } from './_components/clients-landing'
import { ClientsAddButton } from './_components/clients-add-button'
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
  const searchQuery =
    typeof params.q === 'string'
      ? params.q
      : Array.isArray(params.q)
        ? (params.q[0] ?? '')
        : ''
  const cursor =
    typeof params.cursor === 'string'
      ? params.cursor
      : Array.isArray(params.cursor)
        ? (params.cursor[0] ?? null)
        : null
  const directionParam =
    typeof params.dir === 'string'
      ? params.dir
      : Array.isArray(params.dir)
        ? (params.dir[0] ?? null)
        : null
  const direction =
    directionParam === 'backward' ? 'backward' : ('forward' as const)
  const limitParamRaw =
    typeof params.limit === 'string'
      ? params.limit
      : Array.isArray(params.limit)
        ? params.limit[0]
        : undefined
  const limitParam = Number.parseInt(limitParamRaw ?? '', 10)

  const [clients, managementData] = await Promise.all([
    fetchClientsWithMetrics(user),
    listClientsForSettings(user, {
      status: 'active',
      search: searchQuery,
      cursor,
      direction,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    }),
  ])
  return (
    <PageShell
      breadcrumbs={crumbsForNav('/clients')}
      tabs={CLIENTS_TABS}
      activeTab='clients'
      count={{ label: 'clients', total: managementData.totalCount }}
      primaryAction={<ClientsAddButton />}
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        <ClientsLanding clients={clients} />
      </section>
    </PageShell>
  )
}
