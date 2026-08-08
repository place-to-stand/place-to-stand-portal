import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'
import { listClientsForSettings } from '@/lib/queries/clients'

import { CLIENTS_TABS } from '../_lib/tabs'
import { ClientsAddButton } from '../_components/clients-add-button'
import { ClientsManagementTable } from '../_components/clients-management-table'
import { mapClientToTableRow } from '../_lib/map-client-to-table-row'

type ClientsArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: 'Client Archive | Place to Stand Portal',
}

export default async function ClientsArchivePage({
  searchParams,
}: ClientsArchivePageProps) {
  const admin = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}

  const searchQuery =
    typeof params.q === 'string'
      ? params.q
      : Array.isArray(params.q)
        ? params.q[0] ?? ''
        : ''
  const cursor =
    typeof params.cursor === 'string'
      ? params.cursor
      : Array.isArray(params.cursor)
        ? params.cursor[0] ?? null
        : null
  const directionParam =
    typeof params.dir === 'string'
      ? params.dir
      : Array.isArray(params.dir)
        ? params.dir[0] ?? null
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

  const { items, totalCount, pageInfo } =
    await listClientsForSettings(admin, {
      status: 'archived',
      search: searchQuery,
      cursor,
      direction,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    })

  const clientsForTable = items.map(mapClientToTableRow)

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/clients'), { label: 'Archive' }]}
      tabs={CLIENTS_TABS}
      activeTab='archive'
      count={{ label: 'archived clients', total: totalCount }}
      primaryAction={<ClientsAddButton />}
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm space-y-4'>
        <ClientsManagementTable
          clients={clientsForTable}
          pageInfo={pageInfo}
          mode='archive'
        />
      </section>
    </PageShell>
  )
}
