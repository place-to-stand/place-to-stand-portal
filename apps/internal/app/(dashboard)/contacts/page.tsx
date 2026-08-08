import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { listContactsForSettings, listAllActiveClients } from '@/lib/queries/contacts'

import { CONTACTS_TABS } from './_lib/tabs'
import { ContactsAddButton } from './_components/contacts-add-button'
import { ContactsManagementTable } from './_components/contacts-management-table'
import { mapContactToTableRow } from './_lib/map-contact-to-table-row'

export const metadata: Metadata = {
  title: 'Contacts | Place to Stand Portal',
}

const PAGE_SIZE = 20

type ContactsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const user = await requireUser()
  const params = searchParams ? await searchParams : {}

  const searchQuery =
    typeof params.q === 'string'
      ? params.q
      : Array.isArray(params.q)
        ? (params.q[0] ?? '')
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
    listContactsForSettings(user, {
      status: 'active',
      search: searchQuery,
      offset,
      limit: PAGE_SIZE,
    }),
    listAllActiveClients(user),
  ])

  const contactsForTable = items.map(mapContactToTableRow)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/contacts')}
      tabs={CONTACTS_TABS}
      activeTab='contacts'
      count={{ label: 'contacts', total: totalCount }}
      primaryAction={<ContactsAddButton allClients={allClients} />}
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm space-y-4'>
        <ContactsManagementTable
          contacts={contactsForTable}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          mode='active'
          allClients={allClients}
        />
      </section>
    </PageShell>
  )
}
