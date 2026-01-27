'use client'

import Link from 'next/link'
import { Building2, CheckCircle2, Clock, ExternalLink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ClientWithMetrics } from '@/lib/data/clients'
import { getBillingTypeOption } from '@/lib/settings/clients/billing-types'
import { cn } from '@/lib/utils'

import { ActiveProjectsCell } from './active-projects-cell'

type ClientsLandingProps = {
  clients: ClientWithMetrics[]
}

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatHours(hours: number): string {
  return HOURS_FORMATTER.format(hours)
}

export function ClientsLanding({ clients }: ClientsLandingProps) {
  if (clients.length === 0) {
    return (
      <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold'>No clients found</h2>
          <p className='text-muted-foreground text-sm'>
            Clients will appear here once they are created.
          </p>
        </div>
      </div>
    )
  }

  const getClientHref = (client: ClientWithMetrics) => {
    return client.slug ? `/clients/${client.slug}` : `/clients/${client.id}`
  }

  return (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead className='w-[300px]'>Client</TableHead>
            <TableHead>Billing</TableHead>
            <TableHead>Projects</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead className='w-20 text-center'>Referral</TableHead>
            <TableHead className='w-16 text-center'>Links</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map(client => (
            <TableRow key={client.id}>
              <TableCell>
                <Link
                  href={getClientHref(client)}
                  className='flex items-center gap-2 py-1 hover:underline'
                >
                  <Building2 className='h-4 w-4 shrink-0 text-blue-500' />
                  <span className='font-medium'>{client.name}</span>
                </Link>
              </TableCell>
              <TableCell>
                {(() => {
                  const billingOption = getBillingTypeOption(client.billingType)
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
                  {client.referredBy ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className='cursor-default'>
                          <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {client.referrerName ?? 'Referred'}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className='text-muted-foreground/40 text-sm'>—</span>
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
                    <span className='text-muted-foreground/40 text-sm'>—</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
