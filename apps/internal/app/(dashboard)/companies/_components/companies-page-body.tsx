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

export type CompaniesMode = 'active' | 'clients' | 'archive'

const MODES = {
  active: {
    basePath: '/companies',
    crumbs: [],
    countLabel: 'companies',
    empty: 'No companies yet.',
  },
  clients: {
    basePath: '/companies/clients',
    crumbs: [{ label: 'Clients' }],
    countLabel: 'clients',
    empty: 'No clients yet.',
  },
  archive: {
    basePath: '/companies/archive',
    crumbs: [{ label: 'Archive' }],
    countLabel: 'archived companies',
    empty: 'No archived companies.',
  },
} as const

export function CompaniesPageBody({
  mode,
  companies,
  totalCount,
  filteredCount,
  pagination,
  params,
}: {
  mode: CompaniesMode
  /** This page's rows, already filtered and sorted. */
  companies: CompanyListItem[]
  totalCount: number
  /** Rows matching the filters, across every page. */
  filteredCount: number
  pagination: { currentPage: number; totalPages: number; pageSize: number }
  params: CompaniesListParams
}) {
  const view = MODES[mode]
  const filtered = Boolean(
    params.search ||
    (params.type && mode !== 'clients') ||
    params.leads ||
    params.tags.length
  )
  const basePath = view.basePath

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/companies'), ...view.crumbs]}
      tabs={COMPANIES_TABS}
      activeTab={mode === 'active' ? 'companies' : mode}
      count={{
        label: view.countLabel,
        total: totalCount,
        filteredTotal: filteredCount,
      }}
      primaryAction={
        <SheetCreateButton entity='company' label='Create company' />
      }
    >
      <PagePanel className='space-y-4'>
        <CompaniesFilters
          mode={mode}
          search={params.search}
          type={params.type}
          leads={params.leads}
          tags={params.tags}
          basePath={basePath}
        />
        <CompaniesTable
          companies={companies}
          matchingCount={filteredCount}
          sort={params.sortParam}
          basePath={basePath}
          mode={mode === 'archive' ? 'archive' : 'active'}
          bulkPreset={mode === 'clients' ? { type: 'client' } : undefined}
          emptyMessage={
            filtered ? 'No companies match the current filters.' : view.empty
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
