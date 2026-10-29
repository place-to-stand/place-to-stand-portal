'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Star } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { formatRelativeTime } from '@pts/ui/dates'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { EmptyState } from '@pts/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { EmptyValue } from '@/components/table/empty-value'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { useToast } from '@/components/ui/use-toast'
import type { CompanyListItem } from '@/lib/companies/types'
import { displayWebsiteHost } from '@/lib/companies/website'
import { archiveCompany, restoreCompany } from '../actions'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'
import { cn } from '@/lib/utils'

export function CompaniesTable({
  companies,
  emptyMessage,
  sort,
  basePath,
  mode,
}: {
  companies: CompanyListItem[]
  emptyMessage: string
  /** Validated `?sort=`, or undefined for the default (name A–Z). */
  sort: string | undefined
  basePath: string
  mode: 'active' | 'archive'
}) {
  const { open } = useSheetParams()
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<CompanyListItem | null>(
    null
  )

  const runAction = (
    company: CompanyListItem,
    action: 'archive' | 'restore'
  ) => {
    setPendingId(company.id)
    startTransition(async () => {
      const result =
        action === 'archive'
          ? await archiveCompany(company.id)
          : await restoreCompany(company.id)
      setPendingId(null)
      setArchiveTarget(null)
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: `Unable to ${action} company`,
          description: result.error,
        })
        return
      }
      toast({
        title: action === 'archive' ? 'Company archived' : 'Company restored',
        description: company.name,
      })
      router.refresh()
    })
  }
  const { update } = useListParams({ basePath, resetKeys: [] })
  const sortHead = (
    field: string,
    label: string,
    className: string,
    align?: 'center'
  ) => (
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

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table
        density='compact'
        layout='fixed'
        stack
        className='md:min-w-[60rem]'
      >
        <TableHeader>
          <TableRow className='bg-muted/40'>
            {sortHead('name', 'Company', 'w-[26%]')}
            <TableHead className='w-[16%]'>Website</TableHead>
            <TableHead className='w-[11%]'>Type</TableHead>
            <TableHead className='w-[17%]'>Primary contact</TableHead>
            {sortHead('people', 'People', 'w-[8%]', 'center')}
            {sortHead('leads', 'Open leads', 'w-[10%]', 'center')}
            {sortHead('updated', 'Updated', 'w-[12%]')}
            <TableHead className='w-16 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map(company => {
            const host = displayWebsiteHost(company.website)
            return (
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
                    <span className='truncate font-medium' title={company.name}>
                      {company.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  label='Website'
                  className='text-muted-foreground truncate text-sm'
                  title={host ?? undefined}
                >
                  {host ?? <EmptyValue />}
                </TableCell>
                <TableCell label='Type' className='text-sm'>
                  {company.clientName ? (
                    <Badge
                      variant='outline'
                      title={`Client: ${company.clientName}`}
                    >
                      Client
                    </Badge>
                  ) : (
                    <span className='text-muted-foreground'>Prospect</span>
                  )}
                </TableCell>
                <TableCell
                  label='Primary contact'
                  className='truncate text-sm'
                  title={company.primaryContactName ?? undefined}
                >
                  {company.primaryContactName ? (
                    <span className='inline-flex min-w-0 items-center gap-1.5'>
                      <Star className='text-warning h-3.5 w-3.5 shrink-0 fill-current' />
                      <span className='truncate'>
                        {company.primaryContactName}
                      </span>
                    </span>
                  ) : (
                    <EmptyValue />
                  )}
                </TableCell>
                <TableCell
                  label='People'
                  className='text-sm tabular-nums md:text-center'
                >
                  {company.contactCount}
                </TableCell>
                <TableCell
                  label='Open leads'
                  className='text-sm tabular-nums md:text-center'
                >
                  {company.openLeadCount}
                </TableCell>
                <TableCell
                  label='Updated'
                  className='text-muted-foreground truncate text-sm'
                >
                  {formatRelativeTime(company.updatedAt)}
                </TableCell>
                <TableCell className='text-right max-md:ml-auto'>
                  <RecordRowActions>
                    {mode === 'active' ? (
                      <RecordRowAction
                        kind='archive'
                        entity='company'
                        disabled={isPending && pendingId === company.id}
                        onClick={() => setArchiveTarget(company)}
                      />
                    ) : (
                      <RecordRowAction
                        kind='restore'
                        entity='company'
                        disabled={isPending && pendingId === company.id}
                        onClick={() => runAction(company, 'restore')}
                      />
                    )}
                  </RecordRowActions>
                </TableCell>
              </TableRow>
            )
          })}
          {companies.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className='p-4'>
                <EmptyState message={emptyMessage} />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title='Archive company?'
        description={`Archiving ${archiveTarget?.name ?? 'this company'} hides it from the Companies list. Its contacts and leads stay as they are.`}
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && runAction(archiveTarget, 'archive')}
      />
    </div>
  )
}
