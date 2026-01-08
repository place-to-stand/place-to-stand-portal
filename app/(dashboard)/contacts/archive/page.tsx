import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listContactsForSettings, listAllActiveClients } from '@/lib/queries/contacts'

import { ContactsTabsNav } from '../_components/contacts-tabs-nav'
import { ContactsAddButton } from '../_components/contacts-add-button'
import { ContactsManagementTable } from '../_components/contacts-management-table'
import { mapContactToTableRow } from '../_lib/map-contact-to-table-row'

type ContactsArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: 'Contact Archive | Place to Stand Portal',
}

export default async function ContactsArchivePage({
  searchParams,
}: ContactsArchivePageProps) {
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

  const [{ items, totalCount, pageInfo }, allClients] = await Promise.all([
    listContactsForSettings(admin, {
      status: 'archived',
      search: searchQuery,
      cursor,
      direction,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    }),
    listAllActiveClients(admin),
  ])

  const contactsForTable = items.map(mapContactToTableRow)

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Contacts</h1>
          <p className='text-muted-foreground text-sm'>
            Review archived contacts and restore them when needed.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <ContactsTabsNav activeTab='archive' className='flex-1 sm:flex-none' />
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
            <span className='text-muted-foreground text-sm whitespace-nowrap'>
              Total archived: {totalCount}
            </span>
            <ContactsAddButton allClients={allClients} />
          </div>
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm space-y-4'>
          <ContactsManagementTable
            contacts={contactsForTable}
            pageInfo={pageInfo}
            mode='archive'
            allClients={allClients}
          />
        </section>
      </div>
    </>
  )
}
