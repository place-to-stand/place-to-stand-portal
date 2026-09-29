'use client'

import { Archive, Building2, RefreshCw, Trash2 } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
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
import { getStatusBadgeToken } from '@/lib/constants'
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
    resetKeys: ['cursor', 'dir'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isClientSortValue(rawSort) ? rawSort : undefined

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table density='compact' layout='fixed'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <SortableTableHead
              field='name'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='w-[34%]'
            >
              Name
            </SortableTableHead>
            <TableHead className='w-[20%]'>Billing type</TableHead>
            <TableHead className='w-[18%]'>Active projects</TableHead>
            <TableHead className='w-[14%]'>Status</TableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map(client => {
            const activeProjects = client.metrics?.active_projects ?? 0

            const statusLabel = client.deleted_at ? 'Archived' : 'Active'
            const statusTone = client.deleted_at ? 'archived' : 'active'

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
                    <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
                    <span className='truncate font-medium'>{client.name}</span>
                  </div>
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {BILLING_TYPE_LABELS[client.billing_type] ?? '—'}
                </TableCell>
                <TableCell className='text-sm'>{activeProjects}</TableCell>
                <TableCell>
                  <Badge
                    className={cn('text-xs', getStatusBadgeToken(statusTone))}
                  >
                    {statusLabel}
                  </Badge>
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    {showRestore ? (
                      <DisabledFieldTooltip
                        disabled={restoreDisabled}
                        reason={restoreDisabledReason}
                      >
                        <RowActionButton
                          label='Restore client'
                          icon={<RefreshCw />}
                          variant='outline'
                          onClick={() => onRestore(client)}
                          disabled={restoreDisabled}
                        />
                      </DisabledFieldTooltip>
                    ) : null}
                    {showSoftDelete ? (
                      <DisabledFieldTooltip
                        disabled={deleteDisabled}
                        reason={deleteDisabledReason}
                      >
                        <RowActionButton
                          label='Archive client'
                          icon={<Archive />}
                          variant='destructive'
                          onClick={() => onRequestDelete(client)}
                          disabled={deleteDisabled}
                        />
                      </DisabledFieldTooltip>
                    ) : null}
                    {showDestroy ? (
                      <DisabledFieldTooltip
                        disabled={destroyDisabled}
                        reason={destroyDisabledReason}
                      >
                        <RowActionButton
                          label='Permanently delete client'
                          icon={<Trash2 />}
                          variant='destructive'
                          onClick={() => onRequestDestroy(client)}
                          disabled={destroyDisabled}
                        />
                      </DisabledFieldTooltip>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className='p-4'>
                <EmptyState message={emptyMessage} />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
