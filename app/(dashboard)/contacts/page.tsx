import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { isAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { listContactsForSettings, listAllActiveClients } from '@/lib/queries/contacts'

import { ContactsTabsNav } from './_components/contacts-tabs-nav'
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
  const canManageContacts = isAdmin(user)

  if (!canManageContacts) {
    return (
      <>
        <AppShellHeader>
          <div className='flex flex-col'>
            <h1 className='text-2xl font-semibold tracking-tight'>Contacts</h1>
            <p className='text-muted-foreground text-sm'>
              You don&apos;t have permission to view contacts.
            </p>
          </div>
        </AppShellHeader>
      </>
    )
  }

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
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Contacts</h1>
          <p className='text-muted-foreground text-sm'>
            Manage all contacts across your organization.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <ContactsTabsNav activeTab='contacts' className='flex-1 sm:flex-none' />
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
            <span className='text-muted-foreground text-sm whitespace-nowrap'>
              Total contacts: {totalCount}
            </span>
            <ContactsAddButton allClients={allClients} />
          </div>
        </div>
        {/* Main Container with Background */}
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
      </div>
    </>
  )
}
