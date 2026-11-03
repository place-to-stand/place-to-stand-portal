import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import {
  getHourBlockWithClientById,
  listHourBlocksForSettings,
} from '@/lib/queries/hour-blocks'
import { resolveSheetDeepLink } from '@/lib/sheets/resolve-deep-link'
import { hourBlockHref } from '@/lib/sheets/hrefs'
import { parseHourBlocksSearchParams } from '@/lib/hour-blocks/filters'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { HourBlocksAddButton } from './hour-blocks-add-button'
import { HourBlocksFilters } from './hour-blocks-filters'
import { HourBlocksManagementTable } from './hour-blocks-management-table'
import { HOUR_BLOCKS_TABS } from '../_lib/tabs'
import { firstParam } from '@/lib/pagination/params'
import { PagePanel } from '@/components/layout/page-panel'

import type { RawSearchParams } from '@/lib/pagination/params'

export type ListMode = 'active' | 'archive'

const MODES = {
  active: {
    status: 'active',
    tab: 'active',
    activeTab: 'hour-blocks',
    basePath: '/hour-blocks',
    countLabel: 'hour blocks',
    crumbs: [],
  },
  archive: {
    status: 'archived',
    tab: 'archive',
    activeTab: 'archive',
    basePath: '/hour-blocks/archive',
    countLabel: 'archived hour blocks',
    crumbs: [{ label: 'Archive' }],
  },
} as const

/** The hour block list, active or archived: both tabs render this. */
export async function HourBlocksListPage({
  params,
  mode,
}: {
  params: RawSearchParams
  mode: ListMode
}) {
  const view = MODES[mode]
  const currentUser = await requirePage('billing.manage')
  const pageSize = await readPageSize()

  const {
    page: currentPage,
    search,
    sort,
    companyId,
    invoice,
    from,
    to,
  } = parseHourBlocksSearchParams(params)
  const offset = (currentPage - 1) * pageSize

  const { items, clients, totalCount, unfilteredTotalCount } =
    await listHourBlocksForSettings(currentUser, {
      status: view.status,
      offset,
      limit: pageSize,
      search,
      sort,
      companyId,
      invoice,
      from,
      to,
    })

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // The list is paginated and filterable, so resolve `?hour-block=` by id:
  // a shared link must open even when the row isn't on this page, and it
  // moves to the other tab when the block was archived or restored.
  const { record: deepLinkedHourBlock, notFound: hourBlockNotFound } =
    await resolveSheetDeepLink({
      idParam: firstParam(params['hour-block']),
      fetchById: id => getHourBlockWithClientById(currentUser, id),
      tab: view.tab,
      isArchived: block => block.deleted_at !== null,
      archiveHref: id => hourBlockHref(id, { archived: true }),
      activeHref: hourBlockHref,
    })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/hour-blocks'), ...view.crumbs]}
      tabs={HOUR_BLOCKS_TABS}
      activeTab={view.activeTab}
      count={{
        label: view.countLabel,
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<HourBlocksAddButton hasClients={clients.length > 0} />}
    >
      <PagePanel className='space-y-4'>
        <HourBlocksFilters
          basePath={view.basePath}
          search={search}
          companyId={companyId}
          invoice={invoice}
          from={from}
          to={to}
          clients={clients}
        />
        <HourBlocksManagementTable
          hourBlocks={items}
          clients={clients}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          mode={mode}
          basePath={view.basePath}
          deepLinkedHourBlock={deepLinkedHourBlock}
          hourBlockNotFound={hourBlockNotFound}
        />
      </PagePanel>
    </PageShell>
  )
}
