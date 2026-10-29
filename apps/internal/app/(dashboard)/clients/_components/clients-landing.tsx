'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Building2, Clock } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Badge } from '@pts/ui/badge'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { EmptyState } from '@pts/ui/empty-state'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
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
import { DeepLinkNotFoundNotice } from '@/components/table/deep-link-not-found'
import { EmptyValue } from '@/components/table/empty-value'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { PersonAvatar } from '@/components/ui/user-avatar'
import { useListParams } from '@/hooks/use-list-params'
import type { ClientWithMetrics } from '@/lib/data/clients'
import { getBillingTypeOption } from '@/lib/settings/clients/billing-types'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'
import { closerKey, describeClosers } from '@/lib/settings/clients/closers'
import { isClientLandingSortValue } from '@/lib/settings/clients/filters'
import {
  type ClientsTableClient,
  useClientsTableState,
} from '@/lib/settings/clients/use-clients-table-state'
import { cn } from '@/lib/utils'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

import { ActiveProjectsCell } from './active-projects-cell'
import { ClientSheet } from './clients-sheet'
import { LinkedContactsCell } from './linked-contacts-cell'

type ClientsLandingProps = {
  clients: ClientWithMetrics[]
  /**
   * Row resolved server-side from `?client=<id>`. The landing list is
   * filtered, so a shared link can point at a client it doesn't render.
   */
  deepLinkedClient?: ClientRow | null
  /** True when `?client=` points at a client that no longer exists. */
  clientNotFound?: boolean
  currentPage: number
  totalPages: number
  pageSize: number
  /** Filtered total across every page (the footer's `of N`). */
  totalCount: number
}

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatHours(hours: number): string {
  return HOURS_FORMATTER.format(hours)
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * The landing query returns camelCase metric rows; the sheet/table state
 * machine speaks the snake_case `ClientRow` twin. `created_by` is the one
 * field the metrics query doesn't select — nothing in the sheet reads it.
 */
function toTableClient(client: ClientWithMetrics): ClientsTableClient {
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    notes: client.notes,
    state: client.state,
    origination_contact_id: client.originationContactId,
    origination_user_id: client.originationUserId,
    billing_type: client.billingType,
    company_id: client.companyId ?? null,
    label: client.label ?? null,
    created_by: null,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    deleted_at: client.deletedAt,
    closers: client.closers,
    metrics: {
      active_projects: client.activeProjectCount,
      total_projects: client.projectCount,
    },
  }
}

/** The client's originator — an admin (photo) or a contact (initials). */
function OriginatorAvatar({ client }: { client: ClientWithMetrics }) {
  const name = client.originationUserId
    ? (client.originationUserName ?? 'Unknown admin')
    : client.originationContactId
      ? (client.originationContactName ?? 'Unknown contact')
      : null

  if (!name) {
    return <EmptyValue />
  }

  return (
    <PersonAvatar
      userId={client.originationUserId}
      name={name}
      version={client.originationUserUpdatedAt}
      ariaLabel={`Originated by ${name}`}
    />
  )
}

export function ClientsLanding({
  clients,
  deepLinkedClient = null,
  clientNotFound = false,
  currentPage,
  totalPages,
  pageSize,
  totalCount,
}: ClientsLandingProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { update, getParam } = useListParams({
    basePath: '/clients',
    resetKeys: ['page'],
  })

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(page))
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }
  const rawSort = getParam('sort')
  const sort =
    rawSort && isClientLandingSortValue(rawSort) ? rawSort : undefined
  // Guard-validated active search (R4): an empty list under a live `?q=`
  // shows the filtered message, not the default empty state.
  const hasActiveFilter = Boolean(getParam('q')?.trim())
  const emptyMessage = hasActiveFilter
    ? 'No clients match the current filters.'
    : 'No clients yet.'

  const tableClients = useMemo(() => clients.map(toTableClient), [clients])

  // `/clients` is the canonical host page for `?client=` — the landing rows
  // link into the client workspace, so the sheet opens via the Edit action
  // (or a share link / the Add client button), never plain row click.
  const {
    sheetOpen,
    selectedClient,
    deleteTarget,
    isPending,
    pendingReason,
    openEdit,
    clearSelection: clear,
    handleSheetOpenChange,
    handleSheetComplete,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useClientsTableState({ clients: tableClients, deepLinkedClient })

  const sheet = (
    <>
      {clientNotFound ? (
        <DeepLinkNotFoundNotice entity='client' onDismiss={clear} />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title='Archive client?'
        description={
          deleteTarget
            ? `Archiving ${deleteTarget.name} hides it from selectors and reporting. Existing projects stay linked.`
            : 'Archiving this client hides it from selectors and reporting. Existing projects stay linked.'
        }
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <ClientSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        client={selectedClient}
      />
    </>
  )

  const getClientHref = (client: ClientWithMetrics) => {
    return client.slug ? `/clients/${client.slug}` : `/clients/${client.id}`
  }

  return (
    <>
      {sheet}
      <div className='overflow-hidden rounded-lg border'>
        <Table
          density='compact'
          layout='fixed'
          stack
          className='md:min-w-[62.5rem]'
        >
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SortableTableHead
                field='name'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[20%]'
              >
                Client
              </SortableTableHead>
              <SortableTableHead
                field='billing'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[9%]'
              >
                Billing
              </SortableTableHead>
              {/* Ordered by active project count — the number the cell leads with. */}
              <SortableTableHead
                field='projects'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[14%]'
              >
                Projects
              </SortableTableHead>
              {/* Ordered by Portal access count — the number the cell shows. */}
              <SortableTableHead
                field='contacts'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                align='center'
                className='w-[11%]'
              >
                Portal access
              </SortableTableHead>
              {/* Ordered by hours remaining; net_30 rows have none and sort last. */}
              <SortableTableHead
                field='hours'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[19%]'
              >
                Hours
              </SortableTableHead>
              <SortableTableHead
                field='origination'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                align='center'
                className='w-24'
              >
                Origination
              </SortableTableHead>
              <SortableTableHead
                field='closer'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                align='center'
                className='w-20'
              >
                Closer
              </SortableTableHead>
              <TableHead className='w-24 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client, index) => (
              <TableRow
                key={client.id}
                {...getClickableRowProps(() =>
                  router.push(getClientHref(client))
                )}
                className={CLICKABLE_ROW_CLASS}
              >
                <TableCell>
                  <Link
                    href={getClientHref(client)}
                    className='flex min-w-0 items-center gap-2 py-1'
                  >
                    <Building2 className='h-4 w-4 shrink-0 text-blue-500' />
                    <span className='truncate font-medium' title={client.name}>
                      {client.name}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  {(() => {
                    const billingOption = getBillingTypeOption(
                      client.billingType
                    )
                    return (
                      <Badge
                        variant='outline'
                        className={cn('text-xs', billingOption?.badgeClassName)}
                      >
                        {billingOption?.label ?? client.billingType}
                      </Badge>
                    )
                  })()}
                </TableCell>
                <TableCell>
                  <ActiveProjectsCell
                    projects={client.activeProjects}
                    allProjects={client.allProjects}
                    clientSlug={client.slug}
                    clientId={client.id}
                    totalProjectCount={client.projectCount}
                  />
                </TableCell>
                <TableCell label='Portal access' className='text-sm md:text-center'>
                  <LinkedContactsCell contacts={client.contacts} />
                </TableCell>
                <TableCell>
                  {client.billingType === 'prepaid' ? (
                    <div className='flex items-center gap-2 text-sm'>
                      <Clock
                        className={cn(
                          'h-4 w-4',
                          client.hoursRemaining > 0
                            ? 'text-success'
                            : client.hoursRemaining === 0
                              ? 'text-muted-foreground'
                              : 'text-destructive'
                        )}
                      />
                      <span
                        className={cn(
                          client.hoursRemaining > 0
                            ? 'text-success font-medium'
                            : client.hoursRemaining === 0
                              ? 'text-muted-foreground'
                              : 'text-destructive font-medium'
                        )}
                      >
                        {formatHours(client.hoursRemaining)} remaining
                      </span>
                      <span className='text-muted-foreground/60'>
                        ({formatHours(client.totalHoursPurchased)} total)
                      </span>
                    </div>
                  ) : (
                    <EmptyValue />
                  )}
                </TableCell>
                <TableCell label='Origination'>
                  <div className='flex items-center justify-center'>
                    <OriginatorAvatar client={client} />
                  </div>
                </TableCell>
                <TableCell label='Closer'>
                  <div className='flex items-center justify-center'>
                    {client.closers.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className='flex items-center -space-x-1.5'
                            aria-label={`Closed by ${describeClosers(client.closers)}`}
                          >
                            {client.closers.map(closer => (
                              <Avatar
                                key={closerKey(closer)}
                                size='sm'
                                className='ring-card ring-2'
                              >
                                {closer.kind === 'user' ? (
                                  <AvatarImage
                                    src={`/api/storage/user-avatar/${closer.id}?v=${encodeURIComponent(closer.avatarUpdatedAt ?? '')}`}
                                    alt={closer.name}
                                  />
                                ) : null}
                                <AvatarFallback>
                                  {getInitials(closer.name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {describeClosers(client.closers)}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <EmptyValue />
                    )}
                  </div>
                </TableCell>
                <TableCell className='text-right max-md:ml-auto'>
                  <RecordRowActions>
                    <RecordRowAction
                      kind='edit'
                      entity='client'
                      onClick={() => openEdit(tableClients[index])}
                      disabled={isPending}
                    />
                    <RecordRowAction
                      kind='archive'
                      entity='client'
                      onClick={() => handleRequestDelete(tableClients[index])}
                      disabled={isPending}
                      disabledReason={isPending ? pendingReason : null}
                    />
                  </RecordRowActions>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className='p-4'>
                  <EmptyState message={emptyMessage} />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <PaginationControls
        mode='paged'
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />
    </>
  )
}
