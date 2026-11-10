import { PageShell } from '@/components/layout/page-shell'
import type { CompaniesListParams } from '@/lib/companies/filters'
import type { CompanyListItem } from '@/lib/companies/types'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { COMPANIES_TABS } from '../_lib/tabs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { CompaniesFilters } from './companies-filters'
import { CompaniesPagination } from './companies-pagination'
import { CompaniesTable } from './companies-table'
import { PagePanel } from '@/components/layout/page-panel'

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
          ? params.type === 'client'
            ? [...crumbsForNav('/companies'), { label: 'Clients' }]
            : crumbsForNav('/companies')
          : [...crumbsForNav('/companies'), { label: 'Archive' }]
      }
      tabs={COMPANIES_TABS}
      activeTab={
        mode === 'archive'
          ? 'archive'
          : params.type === 'client'
            ? 'clients'
            : 'companies'
      }
      count={{
        label: mode === 'active' ? 'companies' : 'archived companies',
        total: totalCount,
        filteredTotal: filteredCount,
      }}
      primaryAction={
        <SheetCreateButton entity='company' label='Create company' />
      }
    >
      <PagePanel className='space-y-4'>
        <CompaniesFilters
          search={params.search}
          type={params.type}
          leads={params.leads}
          basePath={basePath}
        />
        <CompaniesTable
          companies={companies}
          matchingCount={filteredCount}
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
      </PagePanel>
    </PageShell>
  )
}
