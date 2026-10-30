'use client'

import { useQuery } from '@tanstack/react-query'

import { EmptyState } from '@pts/ui/empty-state'
import { Skeleton } from '@pts/ui/skeleton'
import { SheetSection } from '@/components/sheets/sheet-section'
import {
  LeadRecordRow,
  ProjectRecordRow,
} from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { ClientUpdatesSection } from '@/app/(dashboard)/companies/_components/company-updates-section'
import type { CompanyLeadSummary } from '@/lib/companies/types'
import { projectBoardHref } from '@/lib/sheets/hrefs'
import { cn } from '@/lib/utils'

import { loadCompanyClientWork } from '../actions'
import {
  CompanyBillingFields,
  useCompanyBilling,
} from './company-billing-section'
import { Label } from '@pts/ui/label'
import { ClientBadge } from '@/components/clients/client-badge'
import { Switch } from '@pts/ui/switch'
import { formatCalendarDate } from '@pts/ui/dates'
import { PENDING_REASON } from '@/lib/forms/form-controls'
import { EffectiveMonthSelect } from '@/components/billing/effective-month-select'
import {
  monthLabelFromNow,
  thisOrNextMonthOptions,
} from '@/lib/billing/months'

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

/**
 * The Billing tab (admins). "Bill this company" makes it a client when
 * switched on and saved, and stops billing when switched off; when that
 * takes effect and the billing fields sit right under it. Everything saves
 * with the sheet's Save.
 */
export function CompanyBillingTab({
  companyId,
  disabled,
}: {
  companyId: string | null
  disabled: boolean
}) {
  const billing = useCompanyBilling()
  const { data: work } = useQuery({
    queryKey: ['companyClientWork', companyId],
    queryFn: () => loadCompanyClientWork(companyId!),
    enabled: Boolean(companyId),
    staleTime: 0,
  })
  const { mode, billingOn, effective, setEffective } = billing
  const endsLabel = billing.billingEndsOn
    ? formatCalendarDate(billing.billingEndsOn, {
        month: 'long',
        year: 'numeric',
      })
    : null
  const stopping = mode === 'live' && !billingOn
  // Starting next month still makes it a client on save, portal included.
  const portalNow =
    effective === 'next_month' ? ' Their people can use the portal now.' : ''
  const line =
    mode === 'new'
      ? billingOn
        ? `Saving makes this company a client.${portalNow}`
        : 'Not billed. Switch on and save to make this company a client.'
      : mode === 'former'
        ? billingOn
          ? `Saving restarts billing with its previous setup.${portalNow}`
          : 'Billing stopped. Switch on and save to restart it.'
        : mode === 'ending'
          ? billingOn
            ? 'Saving keeps billing this company.'
            : `Billing stops after ${endsLabel}. Switch on and save to keep billing.`
          : billingOn
            ? null
            : 'Saving stops billing: its people lose portal access. Its projects, invoices and history stay.'
  const isClient = mode === 'live' || mode === 'ending'
  const choice = stopping
    ? {
        title: 'Last month billed',
        // Stopping next month bills this month; stopping now leaves last
        // month as the last one billed.
        options: [
          {
            value: 'next_month' as const,
            label: `${monthLabelFromNow(0)} (this month)`,
          },
          {
            value: 'current_month' as const,
            label: `${monthLabelFromNow(-1)} (last month)`,
          },
        ],
      }
    : billingOn && (mode === 'new' || mode === 'former')
      ? { title: 'First month billed', options: thisOrNextMonthOptions() }
      : null

  return (
    <>
      <SheetSection title='Client' action={isClient ? <ClientBadge /> : null}>
        <div className='flex items-center gap-2'>
          <Switch
            id='company-bill-switch'
            checked={billingOn}
            disabled={disabled || billing.status !== 'ready'}
            onCheckedChange={billing.setBillingOn}
          />
          <Label htmlFor='company-bill-switch'>Bill this company</Label>
        </div>
        {line ? (
          <p
            className={cn(
              'text-sm',
              stopping ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {line}
          </p>
        ) : null}
        {choice ? (
          <EffectiveMonthSelect
            id='company-billing-effective'
            title={choice.title}
            value={effective}
            onChange={setEffective}
            options={choice.options}
            disabled={disabled}
            disabledReason={disabled ? PENDING_REASON : null}
          />
        ) : null}
      </SheetSection>
      {isClient && billingOn && work?.hours ? (
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
      {billingOn && mode !== 'former' ? <CompanyBillingFields /> : null}
    </>
  )
}

const formatHours = (value: number) =>
  `${Number.isInteger(value) ? value : value.toFixed(1)}h`

/** The Projects tab: the client's projects and its latest updates. */
export function CompanyProjectsTab({
  companyId,
  isCreating = false,
}: {
  companyId: string | null
  /** The create sheet: the company has nothing yet. */
  isCreating?: boolean
}) {
  const { data: work, isLoading } = useQuery({
    queryKey: ['companyClientWork', companyId],
    queryFn: () => loadCompanyClientWork(companyId!),
    enabled: Boolean(companyId),
    staleTime: 0,
  })

  if (isCreating) {
    return (
      <SheetSection title='Projects'>
        <EmptyState message='No projects yet.' />
      </SheetSection>
    )
  }
  if (!companyId) {
    return (
      <SheetSection title='Projects'>
        <EmptyState message='Projects belong to clients, and this company isn’t billed yet.' />
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
              <ProjectRecordRow
                key={project.id}
                project={project}
                href={
                  work.clientSlug && project.slug
                    ? projectBoardHref(work.clientSlug, project.slug)
                    : null
                }
              />
            ))}
          </SheetRecordList>
        )}
      </SheetSection>
      <ClientUpdatesSection companyId={companyId} updates={work.updates} />
    </>
  )
}
