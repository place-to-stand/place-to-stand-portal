import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requirePage } from '@/lib/auth/session'
import {
  listContactsForSettings,
  listCompanyFilterOptions,
} from '@/lib/queries/contacts'
import { isRoleFilter, parseContactsSearchParams } from '@/lib/people/filters'
import { serverEnv } from '@/lib/env.server'
import { readPageSize } from '@/lib/pagination/page-size.server'
import { firstParam } from '@/lib/pagination/params'
import { roleCan } from '@/lib/auth/capabilities'
import { redirectLegacyPreset } from '@/lib/pagination/legacy-preset'

import { peopleTabs } from '../_lib/tabs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { ContactsFilters } from './contacts-filters'
import { ContactsManagementTable } from './contacts-management-table'
import { resolveContactDeepLink } from '../_lib/contact-deep-link'
import { mapContactToTableRow } from '../_lib/map-contact-to-table-row'
import { PagePanel } from '@/components/layout/page-panel'

import type { RawSearchParams } from '@/lib/pagination/params'
import { pageSheetParam } from '@/lib/sheets/stack'

export type ListMode = 'active' | 'users' | 'archive'

const MODES = {
  active: {
    status: 'active',
    tab: 'active',
    activeTab: 'people',
    basePath: '/people',
    countLabel: 'people',
    crumbs: [],
  },
  // People who can sign in, for those who manage sign-ins.
  users: {
    status: 'active',
    tab: 'active',
    activeTab: 'users',
    basePath: '/people/users',
    countLabel: 'users',
    crumbs: [{ label: 'Users' }],
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
  const user = await requirePage(
    mode === 'users' ? 'settings.users' : 'contacts.manage'
  )
  // A role means something on Users only. Old Users links
  // (`/people?role=…`, `?signIn=…`) go there for those who can open it;
  // anywhere else the param is dropped, keeping the rest (a `contact=`).
  if (mode !== 'users' && (params.role ?? params.signIn) !== undefined) {
    const legacyRole = firstParam(params.role) ?? firstParam(params.signIn)
    const toUsers =
      mode === 'active' &&
      roleCan(user.role, 'settings.users') &&
      (legacyRole === 'any' || (legacyRole && isRoleFilter(legacyRole)))
    redirectLegacyPreset(
      { ...params, signIn: undefined, role: legacyRole },
      toUsers
        ? { key: 'role', path: '/people/users', keep: isRoleFilter }
        : { key: 'role', path: view.basePath, keep: () => false }
    )
  }
  const pageSize = await readPageSize()
  const {
    page: currentPage,
    search,
    companyId,
    signIn: signInParam,
    sort,
  } = parseContactsSearchParams(params)
  // Users lists every live sign-in, narrowed by its Role filter.
  const role =
    signInParam && isRoleFilter(signInParam) ? signInParam : undefined
  const signIn = mode === 'users' ? (role ?? 'any') : undefined
  const offset = (currentPage - 1) * pageSize

  // Share links: `?contact=<id>` opens the edit sheet even when the row sits
  // on another page (redirects to the other tab when it was archived or
  // restored).
  const deepLink = await resolveContactDeepLink(
    user,
    pageSheetParam('contact', params),
    view.tab
  )

  const [{ items, totalCount, unfilteredTotalCount }, companyOptions] =
    await Promise.all([
      listContactsForSettings(user, {
        status: view.status,
        search,
        companyId,
        signIn,
        listSignIn: mode === 'users' ? 'any' : undefined,
        offset,
        limit: pageSize,
        sort,
      }),
      listCompanyFilterOptions(user, {
        status: view.status,
        search,
        signIn,
        companyId,
      }),
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
      tabs={peopleTabs(user.role)}
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
          role={mode === 'users' ? role : undefined}
          showRoleFilter={mode === 'users'}
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
