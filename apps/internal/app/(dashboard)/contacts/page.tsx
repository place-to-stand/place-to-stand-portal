import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { listContactsForSettings, listAllActiveClients } from '@/lib/queries/contacts'
import { parseContactsSearchParams } from '@/lib/settings/contacts/filters'

import { CONTACTS_TABS } from './_lib/tabs'
import { ContactsAddButton } from './_components/contacts-add-button'
import { ContactsFilters } from './_components/contacts-filters'
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
  const { page: currentPage, search, sort } = parseContactsSearchParams(params)
  const offset = (currentPage - 1) * PAGE_SIZE

  const [{ items, totalCount, unfilteredTotalCount }, allClients] =
    await Promise.all([
      listContactsForSettings(user, {
        status: 'active',
        search,
        offset,
        limit: PAGE_SIZE,
        sort,
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
      count={{
        label: 'contacts',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<ContactsAddButton allClients={allClients} />}
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm space-y-4'>
        <ContactsFilters basePath='/contacts' search={search} />
        <ContactsManagementTable
          contacts={contactsForTable}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          mode='active'
          allClients={allClients}
          basePath='/contacts'
        />
      </section>
    </PageShell>
  )
}
