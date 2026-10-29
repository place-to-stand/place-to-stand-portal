'use client'

import { Building2, Star } from 'lucide-react'

import { formatRelativeTime } from '@pts/ui/dates'
import { EmptyState } from '@pts/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import type { CompanyListItem } from '@/lib/companies/types'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'
import { cn } from '@/lib/utils'

function displayHost(website: string | null) {
  if (!website) return null
  try {
    return new URL(website).hostname.replace(/^www\./, '')
  } catch {
    return website
  }
}

export function CompaniesTable({
  companies,
  emptyMessage,
  sort,
  basePath,
}: {
  companies: CompanyListItem[]
  emptyMessage: string
  /** Validated `?sort=`, or undefined for the default (name A–Z). */
  sort: string | undefined
  basePath: string
}) {
  const { open } = useSheetParams()
  const { update } = useListParams({ basePath, resetKeys: [] })
  const sortHead = (field: string, label: string, className: string, align?: 'center') => (
    <SortableTableHead
      field={field}
      sort={sort}
      defaultSort='name:asc'
      onSortChange={next => update({ sort: next })}
      className={className}
      align={align}
    >
      {label}
    </SortableTableHead>
  )

  if (companies.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table density='compact' layout='fixed' stack className='md:min-w-[50rem]'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            {sortHead('name', 'Company', 'w-[36%]')}
            <TableHead className='w-[24%]'>Champion</TableHead>
            {sortHead('people', 'People', 'w-[11%]', 'center')}
            {sortHead('leads', 'Open leads', 'w-[13%]', 'center')}
            {sortHead('updated', 'Updated', 'w-[16%]')}
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map(company => (
            <TableRow
              key={company.id}
              {...getClickableRowProps(() => open('company', company.id))}
              className={cn(
                CLICKABLE_ROW_CLASS,
                company.deletedAt && ARCHIVED_ROW_CLASS
              )}
            >
              <TableCell>
                <div className='flex min-w-0 items-center gap-2'>
                  <Building2 className='h-4 w-4 shrink-0 text-indigo-500' />
                  <div className='min-w-0'>
                    <span className='block truncate font-medium'>
                      {company.name}
                    </span>
                    {company.clientName || company.website ? (
                      <span className='text-muted-foreground block truncate text-xs'>
                        {company.clientName
                          ? `Client: ${company.clientName}`
                          : displayHost(company.website)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className='truncate text-sm'>
                {company.championName ? (
                  <span className='inline-flex items-center gap-1.5'>
                    <Star className='h-3.5 w-3.5 fill-amber-400 text-amber-500' />
                    {company.championName}
                  </span>
                ) : (
                  <span className='text-muted-foreground'>None yet</span>
                )}
              </TableCell>
              <TableCell className='text-center text-sm tabular-nums'>
                {company.contactCount}
              </TableCell>
              <TableCell className='text-center text-sm tabular-nums'>
                {company.openLeadCount}
              </TableCell>
              <TableCell className='text-muted-foreground text-sm'>
                {formatRelativeTime(company.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
