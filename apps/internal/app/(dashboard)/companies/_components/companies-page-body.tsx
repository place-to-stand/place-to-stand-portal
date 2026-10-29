import { PageShell } from '@/components/layout/page-shell'
import type { CompaniesListParams } from '@/lib/companies/filters'
import type { CompanyListItem } from '@/lib/companies/types'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { COMPANIES_TABS } from '../_lib/tabs'
import { CompaniesAddButton } from './companies-add-button'
import { CompaniesFilters } from './companies-filters'
import { CompaniesTable } from './companies-table'

export function CompaniesPageBody({
  mode,
  companies,
  totalCount,
  params,
}: {
  mode: 'active' | 'archive'
  companies: CompanyListItem[]
  totalCount: number
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
        label: 'companies',
        total: totalCount,
        filteredTotal: companies.length,
      }}
      primaryAction={<CompaniesAddButton />}
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
          emptyMessage={
            filtered
              ? 'No companies match these filters.'
              : mode === 'active'
                ? 'No companies yet.'
                : 'No archived companies.'
          }
        />
      </section>
    </PageShell>
  )
}
