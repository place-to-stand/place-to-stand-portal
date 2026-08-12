import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { getInvoiceById, listInvoices } from '@/lib/queries/invoices'
import { parseInvoicesSearchParams } from '@/lib/invoices/filters'
import { invoiceHref } from '@/lib/sheets/hrefs'
import { resolveSheetDeepLink } from '@/lib/sheets/resolve-deep-link'

import { InvoicesAddButton } from './_components/invoices-add-button'
import { InvoicesFilters } from './_components/invoices-filters'
import { InvoicesManagementTable } from './_components/invoices-management-table'
import { INVOICES_TABS } from './_lib/tabs'

export const metadata: Metadata = {
  title: 'Invoices',
}

const PAGE_SIZE = 20

type InvoicesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvoicesPage({
  searchParams,
}: InvoicesPageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}

  const { page: currentPage, status, search, sort } =
    parseInvoicesSearchParams(params)
  const offset = (currentPage - 1) * PAGE_SIZE

  const {
    items,
    clients,
    productCatalog,
    taxRates,
    totalCount,
    unfilteredTotalCount,
  } = await listInvoices(currentUser, {
    status: 'active',
    offset,
    limit: PAGE_SIZE,
    invoiceStatus: status,
    search,
    sort,
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // The list is paginated and filtered, so a shared `?invoice=` link has to
  // resolve server-side — the row may sit on another page or be filtered out.
  const { record: deepLinkedInvoice, notFound: invoiceNotFound } =
    await resolveSheetDeepLink({
      idParam: typeof params.invoice === 'string' ? params.invoice : undefined,
      fetchById: id => getInvoiceById(currentUser, id),
      tab: 'active',
      isArchived: invoice => Boolean(invoice.deleted_at),
      activeHref: invoiceHref,
      archiveHref: id => `/invoices/archive?invoice=${id}`,
    })

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/invoices')}
      tabs={INVOICES_TABS}
      activeTab='invoices'
      count={{
        label: 'invoices',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<InvoicesAddButton clients={clients} />}
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <InvoicesFilters basePath='/invoices' status={status} search={search} />
        <InvoicesManagementTable
          invoices={items}
          clients={clients}
          productCatalog={productCatalog}
          taxRates={taxRates}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          mode='active'
          basePath='/invoices'
          deepLinkedInvoice={deepLinkedInvoice}
          invoiceNotFound={invoiceNotFound}
        />
      </section>
    </PageShell>
  )
}
