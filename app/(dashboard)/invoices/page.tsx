import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listInvoices } from '@/lib/queries/invoices'

import { InvoicesTabsNav } from './_components/invoices-tabs-nav'
import { InvoicesAddButton } from './_components/invoices-add-button'
import { InvoicesManagementTable } from './_components/invoices-management-table'

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

  const pageParam =
    typeof params.page === 'string'
      ? params.page
      : Array.isArray(params.page)
        ? params.page[0] ?? '1'
        : '1'
  const currentPage = Math.max(1, Number.parseInt(pageParam, 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const { items, clients, productCatalog, totalCount } =
    await listInvoices(currentUser, {
      status: 'active',
      offset,
      limit: PAGE_SIZE,
    })

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Invoices</h1>
          <p className='text-muted-foreground text-sm'>
            Create, send, and track invoices for client billing.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <InvoicesTabsNav activeTab='invoices' className='flex-1 sm:flex-none' />
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
            <span className='text-muted-foreground text-sm whitespace-nowrap'>
              Total invoices: {totalCount}
            </span>
            <InvoicesAddButton clients={clients} productCatalog={productCatalog} />
          </div>
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <InvoicesManagementTable
            invoices={items}
            clients={clients}
            productCatalog={productCatalog}
            totalCount={totalCount}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            mode='active'
          />
        </section>
      </div>
    </>
  )
}
