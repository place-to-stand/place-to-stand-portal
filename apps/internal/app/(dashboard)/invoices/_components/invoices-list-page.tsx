import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { getInvoiceById, listInvoices } from '@/lib/queries/invoices'
import { parseInvoicesSearchParams } from '@/lib/invoices/filters'
import { invoiceHref } from '@/lib/sheets/hrefs'
import { resolveSheetDeepLink } from '@/lib/sheets/resolve-deep-link'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { InvoicesAddButton } from './invoices-add-button'
import { InvoicesFilters } from './invoices-filters'
import { InvoicesManagementTable } from './invoices-management-table'
import { INVOICES_TABS } from '../_lib/tabs'
import { PagePanel } from '@/components/layout/page-panel'

import type { RawSearchParams } from '@/lib/pagination/params'
import { firstSheetParam } from '@/lib/sheets/stack'

export type ListMode = 'active' | 'archive'

const MODES = {
  active: {
    status: 'active',
    tab: 'active',
    activeTab: 'invoices',
    basePath: '/invoices',
    countLabel: 'invoices',
    crumbs: [],
  },
  archive: {
    status: 'archived',
    tab: 'archive',
    activeTab: 'archive',
    basePath: '/invoices/archive',
    countLabel: 'archived invoices',
    crumbs: [{ label: 'Archive' }],
  },
} as const

/** The invoice list, active or archived: both tabs render this. */
export async function InvoicesListPage({
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
    status,
    search,
    sort,
  } = parseInvoicesSearchParams(params)
  const offset = (currentPage - 1) * pageSize

  const {
    items,
    clients,
    productCatalog,
    taxRates,
    totalCount,
    unfilteredTotalCount,
  } = await listInvoices(currentUser, {
    status: view.status,
    offset,
    limit: pageSize,
    invoiceStatus: status,
    search,
    sort,
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // The list is paginated and filtered, so a shared `?invoice=` link has to
  // resolve server-side: the row may sit on another page, be filtered out, or
  // have moved to the other tab (archived or restored).
  const { record: deepLinkedInvoice, notFound: invoiceNotFound } =
    await resolveSheetDeepLink({
      idParam: firstSheetParam('invoice', params.invoice),
      fetchById: id => getInvoiceById(currentUser, id),
      tab: view.tab,
      isArchived: invoice => Boolean(invoice.deleted_at),
      activeHref: invoiceHref,
      archiveHref: id => invoiceHref(id, { archived: true }),
    })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/invoices'), ...view.crumbs]}
      tabs={INVOICES_TABS}
      activeTab={view.activeTab}
      count={{
        label: view.countLabel,
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<InvoicesAddButton hasClients={clients.length > 0} />}
    >
      <PagePanel className='space-y-4'>
        <InvoicesFilters
          basePath={view.basePath}
          status={status}
          search={search}
        />
        <InvoicesManagementTable
          invoices={items}
          clients={clients}
          productCatalog={productCatalog}
          taxRates={taxRates}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          mode={mode}
          basePath={view.basePath}
          deepLinkedInvoice={deepLinkedInvoice}
          invoiceNotFound={invoiceNotFound}
        />
      </PagePanel>
    </PageShell>
  )
}
