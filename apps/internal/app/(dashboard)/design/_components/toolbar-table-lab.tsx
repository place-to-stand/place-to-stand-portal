'use client'

import { useState } from 'react'

import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'

import { DesignSection, Specimen } from './specimen'

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'COMPLETED', label: 'Completed' },
]

const SAMPLE_ROWS = [
  { name: 'Acme Industries', status: 'Active', created: 'Jan 12, 2026' },
  { name: 'Birchwood Labs', status: 'On hold', created: 'Mar 3, 2026' },
  { name: 'Cobalt & Co', status: 'Active', created: 'Jul 28, 2026' },
]

/**
 * §03 toolbar system + §04 density variants, local-state wired (no URL).
 * The real components read/write searchParams via useListParams; here the
 * same props are driven by useState so the page stays static.
 */
export function ToolbarTableLab() {
  const [search, setSearch] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [multi, setMulti] = useState<string[]>(['ACTIVE'])
  const [sort, setSort] = useState<string | undefined>(undefined)

  return (
    <>
      <DesignSection id='toolbar-lab' title='Toolbar lab'>
        <Specimen label='FilterBar — search + single + multi (local state)'>
          <FilterBar>
            <SearchInput
              value={search}
              onCommit={setSearch}
              placeholder='Search things…'
            />
            <FilterSelect
              value={status}
              onChange={setStatus}
              placeholder='All statuses'
              options={STATUS_OPTIONS}
            />
            <FilterSelect
              mode='multi'
              values={multi}
              onChange={setMulti}
              placeholder='Status'
              options={STATUS_OPTIONS}
            />
          </FilterBar>
        </Specimen>
      </DesignSection>
      <DesignSection id='table-lab' title='Table lab'>
        <Specimen label="density='default' vs density='compact' — sortable Name/Created heads (click to cycle asc → desc → default)">
          <div className='grid gap-4 lg:grid-cols-2'>
            {(['default', 'compact'] as const).map(density => (
              <div
                key={density}
                className='overflow-hidden rounded-lg border'
              >
                <Table density={density}>
                  <TableHeader>
                    <TableRow className='bg-muted/40'>
                      <SortableTableHead
                        field='name'
                        sort={sort}
                        defaultSort='name:asc'
                        onSortChange={setSort}
                      >
                        Name
                      </SortableTableHead>
                      <TableHead>Status</TableHead>
                      <SortableTableHead
                        field='created'
                        sort={sort}
                        defaultSort='name:asc'
                        onSortChange={setSort}
                      >
                        Created
                      </SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SAMPLE_ROWS.map(row => (
                      <TableRow key={row.name}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.created}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </Specimen>
        <Specimen label='Filtered empty state'>
          <div className='overflow-hidden rounded-lg border'>
            <Table density='compact'>
              <TableHeader>
                <TableRow className='bg-muted/40'>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className='text-muted-foreground py-10 text-center text-sm'
                  >
                    No records match the current filters.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Specimen>
      </DesignSection>
    </>
  )
}
