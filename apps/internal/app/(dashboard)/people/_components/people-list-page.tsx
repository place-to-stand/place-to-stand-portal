import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requirePage } from '@/lib/auth/session'
import {
  listContactsForSettings,
  listCompanyFilterOptions,
} from '@/lib/queries/contacts'
import { parseContactsSearchParams } from '@/lib/people/filters'
import { serverEnv } from '@/lib/env.server'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { CONTACTS_TABS } from '../_lib/tabs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { ContactsFilters } from './contacts-filters'
import { ContactsManagementTable } from './contacts-management-table'
import { resolveContactDeepLink } from '../_lib/contact-deep-link'
import { mapContactToTableRow } from '../_lib/map-contact-to-table-row'
import { roleCan } from '@/lib/auth/capabilities'
import { PagePanel } from '@/components/layout/page-panel'

import type { RawSearchParams } from '@/lib/pagination/params'

export type ListMode = 'active' | 'archive'

const MODES = {
  active: {
    status: 'active',
    tab: 'active',
    activeTab: 'contacts',
    basePath: '/people',
    countLabel: 'people',
    crumbs: [],
  },
  archive: {
    status: 'archived',
    tab: 'archive',
    activeTab: 'archive',
    basePath: '/people/archive',
    countLabel: 'archived people',
    crumbs: [{ label: 'Archive' }],
  },
} as const

/** The people list, active or archived: both tabs render this. */
export async function PeopleListPage({
  params,
  mode,
}: {
  params: RawSearchParams
  mode: ListMode
}) {
  const view = MODES[mode]
  const user = await requirePage('contacts.manage')
  const pageSize = await readPageSize()
  const {
    page: currentPage,
    search,
    companyId,
    signIn: signInParam,
    sort,
  } = parseContactsSearchParams(params)
  // The sign-in filter is for admins, on the active tab only.
  const signIn = mode === 'active' ? signInParam : undefined
  const showSignInFilter =
    mode === 'active' && roleCan(user.role, 'settings.users')
  const offset = (currentPage - 1) * pageSize

  // Share links: `?contact=<id>` opens the edit sheet even when the row sits
  // on another page (redirects to the other tab when it was archived or
  // restored).
  const contactParam = params.contact
  const deepLink = await resolveContactDeepLink(
    user,
    Array.isArray(contactParam) ? contactParam[0] : contactParam,
    view.tab
  )

  const [{ items, totalCount, unfilteredTotalCount }, companyOptions] =
    await Promise.all([
      listContactsForSettings(user, {
        status: view.status,
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
      breadcrumbs={[...crumbsForNav('/people'), ...view.crumbs]}
      tabs={CONTACTS_TABS}
      activeTab={view.activeTab}
      count={{
        label: view.countLabel,
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={
        <SheetCreateButton entity='contact' label='Create person' />
      }
    >
      <PagePanel className='space-y-4'>
        <ContactsFilters
          basePath={view.basePath}
          search={search}
          companyId={companyId}
          companies={companyOptions}
          signIn={showSignInFilter ? signIn : undefined}
          showSignInFilter={showSignInFilter}
        />
        <ContactsManagementTable
          contacts={contactsForTable}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          mode={mode}
          basePath={view.basePath}
          deepLinkedContact={deepLinkedContact}
          contactNotFound={deepLink.notFound}
          clientPortalUrl={serverEnv.CLIENT_PORTAL_URL ?? ''}
        />
      </PagePanel>
    </PageShell>
  )
}
