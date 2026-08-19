'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, CheckCircle2, Clock, ExternalLink } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@pts/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
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
import type { ClientWithMetrics } from '@/lib/data/clients'
import { getBillingTypeOption } from '@/lib/settings/clients/billing-types'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'
import { isClientLandingSortValue } from '@/lib/settings/clients/filters'
import { useClientSheetSelection } from '@/lib/settings/clients/use-client-sheet-selection'
import { cn } from '@/lib/utils'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

import { ActiveProjectsCell } from './active-projects-cell'
import { ClientSheet } from './clients-sheet'

type ClientsLandingProps = {
  clients: ClientWithMetrics[]
  /**
   * Row resolved server-side from `?client=<id>`. The landing list is
   * filtered, so a shared link can point at a client it doesn't render.
   */
  deepLinkedClient?: ClientRow | null
  /** True when `?client=` points at a client that no longer exists. */
  clientNotFound?: boolean
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

export function ClientsLanding({
  clients,
  deepLinkedClient = null,
  clientNotFound = false,
}: ClientsLandingProps) {
  const router = useRouter()
  const { update, getParam } = useListParams({
    basePath: '/clients',
    resetKeys: ['cursor', 'dir'],
  })
  const rawSort = getParam('sort')
  const sort =
    rawSort && isClientLandingSortValue(rawSort) ? rawSort : undefined
  // Guard-validated active search (R4): an empty list under a live `?q=`
  // shows the filtered message, not the default empty state.
  const hasActiveFilter = Boolean(getParam('q')?.trim())

  // `/clients` is the canonical host page for `?client=` — the landing rows
  // link into the client workspace, so the sheet is driven by the param
  // alone (share links and the Add client button).
  const {
    sheetOpen,
    sheetClient,
    clear,
    handleSheetOpenChange,
    handleSheetComplete,
  } = useClientSheetSelection({ deepLinkedClient })

  const sheet = (
    <>
      {clientNotFound ? (
        <div
          role='status'
          className='border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
        >
          <span>
            The linked client could not be found. It may have been permanently
            deleted.
          </span>
          <Button variant='ghost' size='sm' onClick={clear}>
            Dismiss
          </Button>
        </div>
      ) : null}
      <ClientSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        client={sheetClient}
      />
    </>
  )

  if (clients.length === 0) {
    return (
      <>
        {sheet}
        <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
          <div className='space-y-2'>
            <h2 className='text-lg font-semibold'>No clients found</h2>
            <p className='text-muted-foreground text-sm'>
              {hasActiveFilter
                ? 'No clients match the current filters.'
                : 'Clients will appear here once they are created.'}
            </p>
          </div>
        </div>
      </>
    )
  }

  const getClientHref = (client: ClientWithMetrics) => {
    return client.slug ? `/clients/${client.slug}` : `/clients/${client.id}`
  }

  return (
    <>
      {sheet}
      <div className='rounded-lg border'>
        <Table density='compact' layout='fixed'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SortableTableHead
                field='name'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[300px]'
              >
                Client
              </SortableTableHead>
              <SortableTableHead
                field='billing'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[10%]'
              >
                Billing
              </SortableTableHead>
              {/* Ordered by active project count — the number the cell leads with. */}
              <SortableTableHead
                field='projects'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
              >
                Projects
              </SortableTableHead>
              {/* Ordered by hours remaining; net_30 rows have none and sort last. */}
              <SortableTableHead
                field='hours'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[24%]'
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
              <TableHead className='w-16 text-center'>Links</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map(client => (
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
                    <span className='truncate font-medium'>{client.name}</span>
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
                <TableCell>
                  {client.billingType === 'prepaid' ? (
                    <div className='flex items-center gap-2 text-sm'>
                      <Clock
                        className={cn(
                          'h-4 w-4',
                          client.hoursRemaining > 0
                            ? 'text-emerald-600'
                            : client.hoursRemaining === 0
                              ? 'text-muted-foreground'
                              : 'text-red-600'
                        )}
                      />
                      <span
                        className={cn(
                          client.hoursRemaining > 0
                            ? 'font-medium text-emerald-600'
                            : client.hoursRemaining === 0
                              ? 'text-muted-foreground'
                              : 'font-medium text-red-600'
                        )}
                      >
                        {formatHours(client.hoursRemaining)} remaining
                      </span>
                      <span className='text-muted-foreground/60'>
                        ({formatHours(client.totalHoursPurchased)} total)
                      </span>
                    </div>
                  ) : (
                    <span className='text-muted-foreground/40 text-sm'>—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className='flex items-center justify-center'>
                    {client.originationUserId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className='h-6 w-6'>
                            <AvatarImage
                              src={`/api/storage/user-avatar/${client.originationUserId}?v=${encodeURIComponent(client.originationUserUpdatedAt ?? '')}`}
                              alt={
                                client.originationUserName ?? 'Internal partner'
                              }
                            />
                            <AvatarFallback className='text-[9px]'>
                              {getInitials(client.originationUserName)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          Internal — {client.originationUserName ?? 'partner'}
                        </TooltipContent>
                      </Tooltip>
                    ) : client.originationContactId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className='cursor-default'>
                            <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          External —{' '}
                          {client.originationContactName ?? 'referrer'}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className='text-muted-foreground/40 text-sm'>
                        —
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex items-center justify-center'>
                    {client.closerUserId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className='h-6 w-6'>
                            <AvatarImage
                              src={`/api/storage/user-avatar/${client.closerUserId}?v=${encodeURIComponent(client.closerUserUpdatedAt ?? '')}`}
                              alt={client.closerUserName ?? 'Closer'}
                            />
                            <AvatarFallback className='text-[9px]'>
                              {getInitials(client.closerUserName)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          {client.closerUserName ?? 'Closer'}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className='text-muted-foreground/40 text-sm'>
                        —
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex items-center justify-center gap-1'>
                    {client.website ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={client.website}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-muted-foreground hover:text-foreground transition-colors'
                          >
                            <ExternalLink className='h-4 w-4' />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>
                          {(() => {
                            try {
                              return new URL(client.website).hostname
                            } catch {
                              return client.website
                            }
                          })()}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className='text-muted-foreground/40 text-sm'>
                        —
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
