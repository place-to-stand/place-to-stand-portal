import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'
import { listContactsForSettings, listAllActiveClients } from '@/lib/queries/contacts'
import { parseContactsSearchParams } from '@/lib/settings/contacts/filters'
import { serverEnv } from '@/lib/env.server'

import { CONTACTS_TABS } from '../_lib/tabs'
import { ContactsAddButton } from '../_components/contacts-add-button'
import { ContactsFilters } from '../_components/contacts-filters'
import { ContactsManagementTable } from '../_components/contacts-management-table'
import { resolveContactDeepLink } from '../_lib/contact-deep-link'
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
  const {
    page: currentPage,
    search,
    clientId,
    sort,
  } = parseContactsSearchParams(params)
  const offset = (currentPage - 1) * PAGE_SIZE

  // Share links: `?contact=<id>` opens the edit sheet even when the row sits
  // on another page (redirects to the active tab when it isn't archived).
  const contactParam = params.contact
  const deepLink = await resolveContactDeepLink(
    admin,
    Array.isArray(contactParam) ? contactParam[0] : contactParam,
    'archive'
  )

  const [{ items, totalCount, unfilteredTotalCount }, allClients] =
    await Promise.all([
      listContactsForSettings(admin, {
        status: 'archived',
        search,
        clientId,
        offset,
        limit: PAGE_SIZE,
        sort,
      }),
      listAllActiveClients(admin),
    ])

  const contactsForTable = items.map(mapContactToTableRow)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  // The sheet only needs the minimal row — it self-fetches its client links.
  const deepLinkedContact = deepLink.record
    ? {
        id: deepLink.record.id,
        email: deepLink.record.email,
        name: deepLink.record.name,
        phone: deepLink.record.phone,
      }
    : null

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/contacts'), { label: 'Archive' }]}
      tabs={CONTACTS_TABS}
      activeTab='archive'
      count={{
        label: 'archived contacts',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<ContactsAddButton />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm space-y-4'>
        <ContactsFilters
          basePath='/contacts/archive'
          search={search}
          clientId={clientId}
          clients={allClients}
        />
        <ContactsManagementTable
          contacts={contactsForTable}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          mode='archive'
          allClients={allClients}
          basePath='/contacts/archive'
          deepLinkedContact={deepLinkedContact}
          contactNotFound={deepLink.notFound}
          clientPortalUrl={serverEnv.CLIENT_PORTAL_URL ?? ''}
        />
      </section>
    </PageShell>
  )
}
