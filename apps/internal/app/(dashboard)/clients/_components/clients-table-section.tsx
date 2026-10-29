'use client'

import { Building2 } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import { EmptyValue } from '@/components/table/empty-value'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { isClientSortValue } from '@/lib/settings/clients/filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'

import { cn } from '@/lib/utils'
import type { ClientsTableClient } from '@/lib/settings/clients/use-clients-table-state'
import {
  CLIENT_BILLING_TYPE_SELECT_OPTIONS,
  type ClientBillingTypeValue,
} from '@/lib/settings/clients/billing-types'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

const BILLING_TYPE_LABELS = CLIENT_BILLING_TYPE_SELECT_OPTIONS.reduce<
  Record<ClientBillingTypeValue, string>
>(
  (acc, option) => {
    acc[option.value] = option.label
    return acc
  },
  {} as Record<ClientBillingTypeValue, string>
)

export type ClientsTableSectionProps = {
  clients: ClientsTableClient[]
  mode: 'active' | 'archive'
  onEdit: (client: ClientsTableClient) => void
  onRequestDelete: (client: ClientsTableClient) => void
  onRestore: (client: ClientsTableClient) => void
  onRequestDestroy: (client: ClientsTableClient) => void
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  emptyMessage: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

export function ClientsTableSection({
  clients,
  mode,
  basePath,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  emptyMessage,
}: ClientsTableSectionProps) {
  const { update, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isClientSortValue(rawSort) ? rawSort : undefined

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table
        density='compact'
        layout='fixed'
        stack
        className='md:min-w-[32rem]'
      >
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <SortableTableHead
              field='name'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='w-[45%]'
            >
              Name
            </SortableTableHead>
            <TableHead className='w-[25%]'>Billing type</TableHead>
            <TableHead className='w-[20%] text-center'>
              Active projects
            </TableHead>
            <TableHead className='w-24 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map(client => {
            const activeProjects = client.metrics?.active_projects ?? 0

            const isDeleting = isPending && pendingDeleteId === client.id
            const isRestoring = isPending && pendingRestoreId === client.id
            const isDestroying = isPending && pendingDestroyId === client.id

            const deleteDisabled =
              isDeleting ||
              isRestoring ||
              isDestroying ||
              Boolean(client.deleted_at)
            const deleteDisabledReason = deleteDisabled
              ? isDeleting || isRestoring || isDestroying
                ? pendingReason
                : client.deleted_at
                  ? 'Client already archived.'
                  : null
              : null

            const restoreDisabled = isRestoring || isDeleting || isDestroying
            const restoreDisabledReason = restoreDisabled ? pendingReason : null

            const destroyDisabled =
              isDestroying || isDeleting || isRestoring || !client.deleted_at
            const destroyDisabledReason = destroyDisabled
              ? !client.deleted_at
                ? 'Archive the client before permanently deleting.'
                : pendingReason
              : null

            const showSoftDelete = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

            return (
              <TableRow
                key={client.id}
                {...getClickableRowProps(() => onEdit(client))}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  client.deleted_at && ARCHIVED_ROW_CLASS
                )}
              >
                <TableCell>
                  <div className='flex min-w-0 items-center gap-2'>
                    <Building2 className='h-4 w-4 shrink-0 text-blue-500' />
                    <span className='truncate font-medium' title={client.name}>
                      {client.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  label='Billing'
                  className='text-muted-foreground text-sm'
                >
                  {BILLING_TYPE_LABELS[client.billing_type] ?? <EmptyValue />}
                </TableCell>
                <TableCell
                  label='Active projects'
                  className='text-sm md:text-center'
                >
                  {activeProjects}
                </TableCell>
                <TableCell className='text-right max-md:ml-auto'>
                  <RecordRowActions>
                    {showRestore ? (
                      <RecordRowAction
                        kind='restore'
                        entity='client'
                        onClick={() => onRestore(client)}
                        disabled={restoreDisabled}
                        disabledReason={restoreDisabledReason}
                      />
                    ) : null}
                    {showSoftDelete ? (
                      <RecordRowAction
                        kind='archive'
                        entity='client'
                        onClick={() => onRequestDelete(client)}
                        disabled={deleteDisabled}
                        disabledReason={deleteDisabledReason}
                      />
                    ) : null}
                    {showDestroy ? (
                      <RecordRowAction
                        kind='destroy'
                        entity='client'
                        onClick={() => onRequestDestroy(client)}
                        disabled={destroyDisabled}
                        disabledReason={destroyDisabledReason}
                      />
                    ) : null}
                  </RecordRowActions>
                </TableCell>
              </TableRow>
            )
          })}
          {clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className='p-4'>
                <EmptyState message={emptyMessage} />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
