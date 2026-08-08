import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'
import { listContactsForSettings, listAllActiveClients } from '@/lib/queries/contacts'

import { CONTACTS_TABS } from '../_lib/tabs'
import { ContactsAddButton } from '../_components/contacts-add-button'
import { ContactsManagementTable } from '../_components/contacts-management-table'
import { mapContactToTableRow } from '../_lib/map-contact-to-table-row'

type ContactsArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: 'Contact Archive | Place to Stand Portal',
}

const PAGE_SIZE = 20

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

  const pageParam =
    typeof params.page === 'string'
      ? params.page
      : Array.isArray(params.page)
        ? params.page[0] ?? '1'
        : '1'
  const currentPage = Math.max(1, Number.parseInt(pageParam, 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const [{ items, totalCount }, allClients] = await Promise.all([
    listContactsForSettings(admin, {
      status: 'archived',
      search: searchQuery,
      offset,
      limit: PAGE_SIZE,
    }),
    listAllActiveClients(admin),
  ])

  const contactsForTable = items.map(mapContactToTableRow)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/contacts'), { label: 'Archive' }]}
      tabs={CONTACTS_TABS}
      activeTab='archive'
      count={{ label: 'archived contacts', total: totalCount }}
      primaryAction={<ContactsAddButton allClients={allClients} />}
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm space-y-4'>
        <ContactsManagementTable
          contacts={contactsForTable}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          mode='archive'
          allClients={allClients}
        />
      </section>
    </PageShell>
  )
}
