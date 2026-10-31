import { PageShell } from '@/components/layout/page-shell'
import type { CompaniesListParams } from '@/lib/companies/filters'
import type { CompanyListItem } from '@/lib/companies/types'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { COMPANIES_TABS } from '../_lib/tabs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { CompaniesFilters } from './companies-filters'
import { CompaniesPagination } from './companies-pagination'
import { CompaniesTable } from './companies-table'

export function CompaniesPageBody({
  mode,
  companies,
  totalCount,
  filteredCount,
  pagination,
  params,
}: {
  mode: 'active' | 'archive'
  /** This page's rows, already filtered and sorted. */
  companies: CompanyListItem[]
  totalCount: number
  /** Rows matching the filters, across every page. */
  filteredCount: number
  pagination: { currentPage: number; totalPages: number; pageSize: number }
  params: CompaniesListParams
}) {
  const filtered = Boolean(params.search || params.type || params.leads)
  const basePath = mode === 'active' ? '/companies' : '/companies/archive'

  return (
    <PageShell
      breadcrumbs={
        mode === 'active'
          ? crumbsForNav('/companies')
          : [...crumbsForNav('/companies'), { label: 'Archive' }]
      }
      tabs={COMPANIES_TABS}
      activeTab={mode === 'active' ? 'companies' : 'archive'}
      count={{
        label: mode === 'active' ? 'companies' : 'archived companies',
        total: totalCount,
        filteredTotal: filteredCount,
      }}
      primaryAction={
        <SheetCreateButton entity='company' label='Create company' />
      }
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <CompaniesFilters
          search={params.search}
          type={params.type}
          leads={params.leads}
          basePath={basePath}
        />
        <CompaniesTable
          companies={companies}
          sort={params.sortParam}
          basePath={basePath}
          mode={mode}
          emptyMessage={
            filtered
              ? 'No companies match the current filters.'
              : mode === 'active'
                ? 'No companies yet.'
                : 'No archived companies.'
          }
        />
        <CompaniesPagination
          basePath={basePath}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={filteredCount}
          pageSize={pagination.pageSize}
        />
      </section>
    </PageShell>
  )
}
