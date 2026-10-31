'use client'

import { useQuery } from '@tanstack/react-query'

import { EmptyState } from '@pts/ui/empty-state'
import { Button } from '@pts/ui/button'
import { Skeleton } from '@pts/ui/skeleton'
import { EntityList } from '@/components/sheets/entity-list'
import { SaveSideEffect } from '@/components/sheets/save-side-effect'
import { SheetSection } from '@/components/sheets/sheet-section'
import { StatCard } from '@/components/ui/stat-card'
import {
  LeadRecordRow,
  ProjectRecordRow,
} from '@/components/sheets/entity-record-rows'
import { ClientUpdatesSection } from '@/app/(dashboard)/companies/_components/company-updates-section'
import type { CompanyLeadSummary } from '@/lib/companies/types'
import { projectBoardHref } from '@/lib/sheets/hrefs'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertContent, AlertDescription } from '@pts/ui/alert'

import { loadCompanyClientWork } from '../actions'
import {
  CompanyBillingFields,
  useCompanyBilling,
} from './company-billing-section'
import { Label } from '@pts/ui/label'
import { ClientBadge } from '@/components/clients/client-badge'
import { Switch } from '@pts/ui/switch'
import { formatCalendarDate } from '@pts/ui/dates'
import { formatHours } from '@pts/ui/numbers'
import { PENDING_REASON } from '@/lib/forms/form-controls'
import { balanceTone } from '@/lib/billing/balance-tone'
import { EffectiveMonthSelect } from '@/components/billing/effective-month-select'
import {
  addMonths,
  monthLabel,
  monthLabelFromNow,
  thisOrNextMonthOptions,
} from '@/lib/billing/months'
import { CLIENT_BILLING_TYPE_SELECT_OPTIONS } from '@/lib/companies/billing/billing-types'

export function CompanyLeadsSection({
  leads,
}: {
  leads: CompanyLeadSummary[]
}) {
  return (
    <EntityList
      title='Leads'
      isEmpty={leads.length === 0}
      emptyMessage='No leads at this company.'
    >
      {leads.map(lead => (
        <LeadRecordRow key={lead.id} lead={lead} />
      ))}
    </EntityList>
  )
}

/**
 * The Client column's billing (admins): the "Bill this company" switch is
 * always there. Switched on, a company becomes a client (or a former client
 * restarts) on Save and the billing fields appear under it; switched off, a
 * client stops billing on Save. When that takes effect and
 * the billing fields sit right under it. Everything saves with the sheet's
 * Save.
 */
export function CompanyBillingSection({
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
  const isClient = mode === 'live' || mode === 'ending'
  const lastType = CLIENT_BILLING_TYPE_SELECT_OPTIONS.find(
    option => option.value === billing.client?.billing_type
  )?.label
  // A former client's last billed month: billing ended the month before its
  // ended-at (the latest billing period's close).
  const endedAt = billing.client?.deleted_at ?? null
  const lastBilled =
    mode === 'former' && endedAt
      ? monthLabel(addMonths(`${endedAt.slice(0, 7)}-01`, -1))
      : null
  const stopping = isClient && !billingOn
  // Starting next month still makes it a client on save, portal included.
  const portalNow =
    effective === 'next_month' ? ' Their people can use the portal now.' : ''
  // What Save does (a caution alert), or just where billing stands.
  const onSave = (text: string) => ({ text, onSave: true })
  const state = (text: string) => ({ text, onSave: false })
  const line =
    mode === 'new'
      ? billingOn
        ? onSave(`This company becomes a client when you save.${portalNow}`)
        : null
      : mode === 'former'
        ? billingOn
          ? onSave(
              'Billing restarts with these terms when you save, with any changes from its first month billed. Its people with Portal on get portal access back.'
            )
          : state(
              lastBilled
                ? `Former client. Last billed ${lastBilled}${lastType ? `, ${lastType}` : ''}.`
                : `Former client${lastType ? `, last billed ${lastType}` : ''}. Billing stopped.`
            )
        : mode === 'ending' && billingOn
          ? billing.keepBilling
            ? onSave(
                'The stop is cancelled and billing continues when you save.'
              )
            : state(`Billing stops after ${endsLabel}.`)
          : billingOn
            ? null
            : onSave(
                'Billing stops when you save. Their people lose portal access when billing ends; projects, invoices and history stay.'
              )
  // A stop before this month leaves this month's net 30 time unbilled.
  const unbilledHours =
    stopping && effective === 'current_month'
      ? (work?.hoursLoggedThisMonth ?? 0)
      : 0
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
    : // A first-time client just bills from this month; restarting a former
      // one asks which month.
      billingOn && mode === 'former'
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
        {line?.onSave ? (
          <SaveSideEffect>{line.text}</SaveSideEffect>
        ) : line ? (
          <p className='text-muted-foreground text-sm'>{line.text}</p>
        ) : null}
        {mode === 'ending' && billingOn ? (
          <div>
            <Button
              type='button'
              size='sm'
              variant={billing.keepBilling ? 'secondary' : 'outline'}
              aria-pressed={billing.keepBilling}
              disabled={disabled}
              onClick={() => billing.setKeepBilling(!billing.keepBilling)}
            >
              Keep billing
            </Button>
          </div>
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
        {unbilledHours > 0 ? (
          <Alert variant='warning'>
            <TriangleAlert />
            <AlertContent>
              <AlertDescription>
                {formatHours(unbilledHours)} logged this month won’t be billed.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : null}
      </SheetSection>
      {isClient && billingOn && work?.hours ? (
        // `list`: 8px under the heading, like a field label over its input.
        <SheetSection list title='Hours'>
          <div className='grid grid-cols-3 gap-3'>
            {(
              [
                ['Purchased', work.hours.purchased],
                ['Used', work.hours.used],
                ['Remaining', work.hours.remaining],
              ] as const
            ).map(([label, value]) => (
              <StatCard
                key={label}
                label={label}
                value={formatHours(value)}
                tone={label === 'Remaining' ? balanceTone(value) : 'default'}
              />
            ))}
          </div>
        </SheetSection>
      ) : null}
      {billingOn ? <CompanyBillingFields /> : null}
    </>
  )
}

/**
 * The Client column for someone who can't manage clients (Sales): where the
 * company stands, read-only. Billing, projects and portal access stay with
 * admins.
 */
export function CompanyClientReadOnly({
  isClient,
  wasClient,
}: {
  isClient: boolean
  wasClient: boolean
}) {
  return (
    <SheetSection title='Client' action={isClient ? <ClientBadge /> : null}>
      {isClient ? (
        <p className='text-muted-foreground text-sm'>
          Only an admin can change a client’s billing.
        </p>
      ) : (
        <EmptyState
          message={
            wasClient
              ? 'Former client. Only an admin can restart billing.'
              : 'Not a client. Only an admin can make a company a client.'
          }
        />
      )}
    </SheetSection>
  )
}

/**
 * The company's latest client updates (clients and former clients), on the
 * Client column, last (the activity stream ends a sheet).
 */
export function CompanyClientUpdates({ companyId }: { companyId: string }) {
  const { data: work } = useQuery({
    queryKey: ['companyClientWork', companyId],
    queryFn: () => loadCompanyClientWork(companyId),
    staleTime: 0,
  })
  if (!work) return <Skeleton className='h-24 w-full' />
  return <ClientUpdatesSection companyId={companyId} updates={work.updates} />
}

/**
 * The Client column's Projects (clients, and former clients with projects),
 * as record rows, with Create project on a current client.
 */
export function CompanyProjectsSection({
  companyId,
  canCreate,
}: {
  companyId: string
  /** A current client: new projects can start here. */
  canCreate: boolean
}) {
  const { openNew } = useSheetParams()
  const { data: work, isLoading } = useQuery({
    queryKey: ['companyClientWork', companyId],
    queryFn: () => loadCompanyClientWork(companyId),
    staleTime: 0,
  })

  if (isLoading || !work) {
    return (
      <EntityList
        title='Projects'
        isEmpty={false}
        emptyMessage=''
        status={<Skeleton className='h-24 w-full' />}
      />
    )
  }

  return (
    <EntityList
      title='Projects'
      add={
        canCreate
          ? {
              label: 'Create project',
              onAdd: () => openNew('project', { projectCompanyId: companyId }),
            }
          : undefined
      }
      isEmpty={work.projects.length === 0}
      emptyMessage='No projects yet.'
    >
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
    </EntityList>
  )
}
