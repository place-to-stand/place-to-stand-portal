'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { EmptyState } from '@pts/ui/empty-state'
import { Skeleton } from '@pts/ui/skeleton'
import { SheetSection } from '@/components/sheets/sheet-section'
import { LeadRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { ClientUpdatesSection } from '@/app/(dashboard)/clients/[clientSlug]/_components/client-updates-section'
import { getProjectStatusLabel } from '@/lib/constants'
import type { CompanyLeadSummary } from '@/lib/companies/types'
import { projectBoardHref } from '@/lib/sheets/hrefs'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'

import { loadCompanyClientWork } from '../actions'
import { CompanyBillingFields } from './company-billing-section'


export function CompanyLeadsSection({
  leads,
}: {
  leads: CompanyLeadSummary[]
}) {
  return (
    <SheetSection
      title='Leads'
      action={
        <span className='text-muted-foreground text-xs'>{leads.length}</span>
      }
    >
      {leads.length === 0 ? (
        <EmptyState message='No leads at this company.' />
      ) : (
        <SheetRecordList>
          {leads.map(lead => (
            <LeadRecordRow key={lead.id} lead={lead} />
          ))}
        </SheetRecordList>
      )}
    </SheetSection>
  )
}

/** The Billing tab (admins): Make client, or the client's billing. */
export function CompanyBillingTab({
  companyId,
  clientId,
  disabled,
}: {
  companyId: string
  clientId: string | null
  disabled: boolean
}) {
  const { openNew } = useSheetParams()
  const { data: work } = useQuery({
    queryKey: ['companyClientWork', clientId],
    queryFn: () => loadCompanyClientWork(clientId!),
    enabled: Boolean(clientId),
    staleTime: 0,
  })

  if (!clientId) {
    return (
      <SheetSection title='Billing'>
        <EmptyState
          message='Not a client yet. Make client sets up billing type, commission and portal access for this company.'
          label={disabled ? undefined : 'Make client'}
          onClick={
            disabled
              ? undefined
              : () => openNew('client', { clientCompanyId: companyId })
          }
        />
      </SheetSection>
    )
  }

  return (
    <>
      {work?.hours ? (
        <SheetSection title='Hours'>
          <dl className='grid grid-cols-3 gap-4 text-sm'>
            {(
              [
                ['Remaining', work.hours.remaining],
                ['Purchased', work.hours.purchased],
                ['Used', work.hours.used],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className='space-y-1'>
                <dt className='text-muted-foreground text-xs'>{label}</dt>
                <dd
                  className={cn(
                    'tabular-nums',
                    label === 'Remaining' && value < 0 && 'text-destructive'
                  )}
                >
                  {formatHours(value)}
                </dd>
              </div>
            ))}
          </dl>
        </SheetSection>
      ) : null}
      <CompanyBillingFields />
    </>
  )
}

const formatHours = (value: number) =>
  `${Number.isInteger(value) ? value : value.toFixed(1)}h`

/** The Projects tab: the client's projects and its latest updates. */
export function CompanyProjectsTab({ clientId }: { clientId: string | null }) {
  const { data: work, isLoading } = useQuery({
    queryKey: ['companyClientWork', clientId],
    queryFn: () => loadCompanyClientWork(clientId!),
    enabled: Boolean(clientId),
    staleTime: 0,
  })

  if (!clientId) {
    return (
      <SheetSection title='Projects'>
        <EmptyState message='Projects belong to clients. Make client on the Billing tab to start one.' />
      </SheetSection>
    )
  }
  if (isLoading || !work) {
    return <Skeleton className='h-24 w-full' />
  }

  return (
    <>
      <SheetSection
        title='Projects'
        action={
          <span className='text-muted-foreground text-xs'>
            {work.projects.length}
          </span>
        }
      >
        {work.projects.length === 0 ? (
          <EmptyState message='No projects yet.' />
        ) : (
          <SheetRecordList>
            {work.projects.map(project => (
              <Link
                key={project.id}
                href={
                  work.clientSlug && project.slug
                    ? projectBoardHref(work.clientSlug, project.slug)
                    : '#'
                }
                className='hover:bg-muted/50 flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors'
              >
                <FolderKanban className='size-4 shrink-0 text-emerald-500' />
                <span className='min-w-0 flex-1 truncate font-medium'>
                  {project.name}
                </span>
                <span className='text-muted-foreground text-xs tabular-nums'>
                  {project.doneTasks}/{project.totalTasks} tasks
                </span>
                <Badge variant='outline' className='text-xs font-normal'>
                  {getProjectStatusLabel(project.status)}
                </Badge>
              </Link>
            ))}
          </SheetRecordList>
        )}
      </SheetSection>
      <ClientUpdatesSection clientId={clientId} updates={work.updates} />
    </>
  )
}
