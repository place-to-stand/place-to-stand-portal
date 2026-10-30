import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireCrmUser } from '@/lib/auth/session'
import { isAdminRole } from '@/lib/auth/roles'
import {
  listContactsForSettings,
  listCompanyFilterOptions,
} from '@/lib/queries/contacts'
import { parseContactsSearchParams } from '@/lib/settings/contacts/filters'
import { serverEnv } from '@/lib/env.server'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { CONTACTS_TABS } from './_lib/tabs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { ContactsFilters } from './_components/contacts-filters'
import { ContactsManagementTable } from './_components/contacts-management-table'
import { resolveContactDeepLink } from './_lib/contact-deep-link'
import { mapContactToTableRow } from './_lib/map-contact-to-table-row'

export const metadata: Metadata = {
  title: 'People',
}

export default async function ContactsPage({
  searchParams,
}: PageProps<'/people'>) {
  const user = await requireCrmUser()
  const params = await searchParams
  const pageSize = await readPageSize()
  const {
    page: currentPage,
    search,
    companyId,
    signIn,
    sort,
  } = parseContactsSearchParams(params)
  const isAdmin = isAdminRole(user.role)
  const offset = (currentPage - 1) * pageSize

  // Share links: `?contact=<id>` opens the edit sheet even when the row sits
  // on another page (redirects to the archive tab when it's archived).
  const contactParam = params.contact
  const deepLink = await resolveContactDeepLink(
    user,
    Array.isArray(contactParam) ? contactParam[0] : contactParam,
    'active'
  )

  const [{ items, totalCount, unfilteredTotalCount }, companyOptions] =
    await Promise.all([
      listContactsForSettings(user, {
        status: 'active',
        search,
        companyId,
        signIn,
        offset,
        limit: pageSize,
        sort,
      }),
      listCompanyFilterOptions(user),
    ])

  const contactsForTable = items.map(mapContactToTableRow)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  // The sheet only needs the minimal row — it self-fetches its client links.
  const deepLinkedContact = deepLink.record
    ? {
        id: deepLink.record.id,
        email: deepLink.record.email,
        name: deepLink.record.name,
        phone: deepLink.record.phone,
        userId: deepLink.record.userId,
        jobTitle: deepLink.record.jobTitle,
        linkedinUrl: deepLink.record.linkedinUrl,
        companyId: deepLink.record.companyId,
        companyName: deepLink.record.companyName,
      }
    : null

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/people')}
      tabs={CONTACTS_TABS}
      activeTab='contacts'
      count={{
        label: 'people',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={
        <SheetCreateButton entity='contact' label='Create person' />
      }
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <ContactsFilters
          basePath='/people'
          search={search}
          companyId={companyId}
          companies={companyOptions}
          signIn={isAdmin ? signIn : undefined}
          showSignInFilter={isAdmin}
        />
        <ContactsManagementTable
          contacts={contactsForTable}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          mode='active'
          basePath='/people'
          deepLinkedContact={deepLinkedContact}
          contactNotFound={deepLink.notFound}
          clientPortalUrl={serverEnv.CLIENT_PORTAL_URL ?? ''}
        />
      </section>
    </PageShell>
  )
}
